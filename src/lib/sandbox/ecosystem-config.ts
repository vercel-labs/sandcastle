import { PORTS } from "./ports";

// All sandcastle services live under /opt/sandcastle/ to stay out of $HOME
export const SERVICE_DIR = "/opt/sandcastle";

// Xpra display number - use :10 to avoid low display warnings
export const XPRA_DISPLAY = ":10";

// Well-known D-Bus session bus socket path used by all sandcastle processes.
// dbus-daemon is started by the Xpra wrapper and writes its address here.
export const DBUS_SOCKET_PATH = "/tmp/sandcastle-dbus";

// Shared file where the sandbox bridge writes notification/settings state.
// The Node.js sandbox service reads this to serve /bridge/* API routes.
export const BRIDGE_STATE_PATH = "/tmp/sandcastle-bridge.json";

export function getEcosystemConfig(): string {
  const xpraStartScript = `${SERVICE_DIR}/xpra-start.sh`;
  const sandboxBridgeScript = `${SERVICE_DIR}/sandbox-bridge.py`;

  return `const HOME = process.env.HOME || require("os").homedir();
module.exports = {
  apps: [
    {
      name: "sandcastle-svc",
      script: "${SERVICE_DIR}/service.js",
      cwd: "${SERVICE_DIR}",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "code-server",
      script: "code-server",
      args: "--bind-addr 0.0.0.0:${PORTS.CODE_SERVER} --auth none --disable-telemetry " + HOME,
      interpreter: "none",
      cwd: HOME,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "xpra",
      script: "${xpraStartScript}",
      interpreter: "bash",
      cwd: HOME,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      env: {
        DBUS_SESSION_BUS_ADDRESS: "unix:path=${DBUS_SOCKET_PATH}",
      },
    },
    {
      name: "sandbox-bridge",
      script: "${sandboxBridgeScript}",
      interpreter: "python3",
      cwd: "${SERVICE_DIR}",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        DBUS_SESSION_BUS_ADDRESS: "unix:path=${DBUS_SOCKET_PATH}",
        BRIDGE_STATE_PATH: "${BRIDGE_STATE_PATH}",
      },
    },

  ],
};
`;
}

/**
 * Sandbox bridge daemon (Python).
 *
 * A long-lived daemon inside each sandbox that bridges D-Bus services,
 * monitors .desktop files, and communicates with the browser through a
 * shared JSON state file at BRIDGE_STATE_PATH.
 *
 * D-Bus services claimed on the session bus:
 *
 * 1. org.freedesktop.Notifications — implements the Desktop Notifications
 *    Specification so `notify-send` and GLib/GTK apps can send notifications.
 *
 * 2. org.freedesktop.ScreenSaver — stubs Inhibit/UnInhibit so GTK apps
 *    (video players, presentation tools) don't think the session is idle.
 *
 * 3. org.freedesktop.portal.Desktop (Settings only) — exposes the
 *    org.freedesktop.portal.Settings interface so GTK4/libadwaita apps can
 *    read the current color-scheme (dark/light) without a full xdg-desktop-portal.
 *
 * Other responsibilities:
 *
 * 4. .desktop file monitoring — uses inotify to watch application directories
 *    and bumps an appsGeneration counter when apps are installed or removed.
 */
export function getSandboxBridgeScript(): string {
  return `#!/usr/bin/env python3
"""
sandcastle sandbox bridge daemon.

Bridges D-Bus services and monitors .desktop files, communicating with the
browser via a shared JSON state file that the Node.js sandbox service reads.

Requires: python3-dbus, python3-pyxdg (PyGObject for GLib main loop)
"""

import os
import sys
import json
import time
import signal
import struct
import ctypes
import ctypes.util
import threading

import dbus
import dbus.service
import dbus.mainloop.glib
from gi.repository import GLib

STATE_PATH = os.environ.get("BRIDGE_STATE_PATH", "/tmp/sandcastle-bridge.json")
LOCK_PATH = STATE_PATH + ".lock"

# ---- Shared state ----

_state_lock = threading.Lock()
_notification_id_counter = 1
_notifications = []     # list of notification dicts
_color_scheme = 1       # 0=default, 1=prefer-dark, 2=prefer-light
_screensaver_cookie = 0
_screensaver_inhibitors = {}
_apps_generation = 0    # bumped when .desktop files change


def _read_state():
    """Read current state from disk (for settings updates from Node.js)."""
    global _color_scheme
    try:
        with open(STATE_PATH, "r") as f:
            data = json.load(f)
        _color_scheme = data.get("colorScheme", _color_scheme)
    except (FileNotFoundError, json.JSONDecodeError, IOError):
        pass


def _write_state():
    """Atomically write current state to disk for the Node.js service to read."""
    data = {
        "notifications": _notifications[-100:],
        "colorScheme": _color_scheme,
        "inhibited": len(_screensaver_inhibitors) > 0,
        "appsGeneration": _apps_generation,
    }
    tmp = STATE_PATH + ".tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, STATE_PATH)
    except IOError as e:
        print(f"[sandbox-bridge] Failed to write state: {e}", file=sys.stderr)


# ---- org.freedesktop.Notifications ----

NOTIFICATIONS_XML = '''
<node>
  <interface name="org.freedesktop.Notifications">
    <method name="Notify">
      <arg direction="in"  type="s" name="app_name"/>
      <arg direction="in"  type="u" name="replaces_id"/>
      <arg direction="in"  type="s" name="app_icon"/>
      <arg direction="in"  type="s" name="summary"/>
      <arg direction="in"  type="s" name="body"/>
      <arg direction="in"  type="as" name="actions"/>
      <arg direction="in"  type="a{sv}" name="hints"/>
      <arg direction="in"  type="i" name="expire_timeout"/>
      <arg direction="out" type="u" name="id"/>
    </method>
    <method name="CloseNotification">
      <arg direction="in"  type="u" name="id"/>
    </method>
    <method name="GetCapabilities">
      <arg direction="out" type="as" name="capabilities"/>
    </method>
    <method name="GetServerInformation">
      <arg direction="out" type="s" name="name"/>
      <arg direction="out" type="s" name="vendor"/>
      <arg direction="out" type="s" name="version"/>
      <arg direction="out" type="s" name="spec_version"/>
    </method>
    <signal name="NotificationClosed">
      <arg type="u" name="id"/>
      <arg type="u" name="reason"/>
    </signal>
    <signal name="ActionInvoked">
      <arg type="u" name="id"/>
      <arg type="s" name="action_key"/>
    </signal>
  </interface>
</node>
'''


class NotificationDaemon(dbus.service.Object):
    def __init__(self, bus):
        super().__init__(bus, "/org/freedesktop/Notifications")

    @dbus.service.method("org.freedesktop.Notifications",
                         in_signature="susssasa{sv}i", out_signature="u")
    def Notify(self, app_name, replaces_id, app_icon, summary, body,
               actions, hints, expire_timeout):
        global _notification_id_counter
        with _state_lock:
            if replaces_id > 0:
                nid = int(replaces_id)
            else:
                nid = _notification_id_counter
                _notification_id_counter += 1

            # Extract well-known hints from the D-Bus hints dict
            urgency_val = int(hints.get("urgency", 1)) if "urgency" in hints else 1
            urgency_map = {0: "low", 1: "normal", 2: "critical"}
            urgency = urgency_map.get(urgency_val, "normal")

            category = str(hints["category"]) if "category" in hints else None
            is_transient = bool(hints.get("transient", False))
            is_resident = bool(hints.get("resident", False))
            desktop_entry = str(hints["desktop-entry"]) if "desktop-entry" in hints else None
            image_path = str(hints["image-path"]) if "image-path" in hints else None

            # Prefer image-path hint over app_icon parameter
            icon = image_path or (str(app_icon) if app_icon else None)

            # Critical notifications persist until dismissed (override timeout)
            effective_expires = 0 if urgency == "critical" else int(expire_timeout)

            notif = {
                "id": nid,
                "appName": str(app_name),
                "replacesId": int(replaces_id),
                "icon": icon,
                "summary": str(summary),
                "body": str(body),
                "actions": [str(a) for a in actions],
                "expires": effective_expires,
                "timestamp": int(time.time() * 1000),
                "urgency": urgency,
                "category": category,
                "transient": is_transient,
                "resident": is_resident,
                "desktopEntry": desktop_entry,
            }

            # Replace existing notification if replaces_id is set
            if replaces_id > 0:
                _notifications[:] = [n for n in _notifications if n["id"] != nid]

            _notifications.append(notif)
            _write_state()

        return dbus.UInt32(nid)

    @dbus.service.method("org.freedesktop.Notifications",
                         in_signature="u", out_signature="")
    def CloseNotification(self, nid):
        with _state_lock:
            _notifications[:] = [n for n in _notifications if n["id"] != int(nid)]
            _write_state()
        self.NotificationClosed(dbus.UInt32(nid), dbus.UInt32(3))

    @dbus.service.method("org.freedesktop.Notifications",
                         in_signature="", out_signature="as")
    def GetCapabilities(self):
        return dbus.Array([
                           "body", "body-markup",
                           "icon-static", "actions",
                           "persistence", "action-icons",
                       ], signature="s")

    @dbus.service.method("org.freedesktop.Notifications",
                         in_signature="", out_signature="ssss")
    def GetServerInformation(self):
        return ("sandcastle-bridge", "sandcastle", "1.0", "1.2")

    @dbus.service.signal("org.freedesktop.Notifications",
                         signature="uu")
    def NotificationClosed(self, nid, reason):
        pass

    @dbus.service.signal("org.freedesktop.Notifications",
                         signature="us")
    def ActionInvoked(self, nid, action_key):
        pass


# ---- org.freedesktop.ScreenSaver ----

class ScreenSaverInhibitor(dbus.service.Object):
    def __init__(self, bus):
        super().__init__(bus, "/org/freedesktop/ScreenSaver")

    @dbus.service.method("org.freedesktop.ScreenSaver",
                         in_signature="ss", out_signature="u")
    def Inhibit(self, app_name, reason):
        global _screensaver_cookie
        with _state_lock:
            _screensaver_cookie += 1
            cookie = _screensaver_cookie
            _screensaver_inhibitors[cookie] = {
                "app": str(app_name),
                "reason": str(reason),
            }
            _write_state()
        return dbus.UInt32(cookie)

    @dbus.service.method("org.freedesktop.ScreenSaver",
                         in_signature="u", out_signature="")
    def UnInhibit(self, cookie):
        with _state_lock:
            _screensaver_inhibitors.pop(int(cookie), None)
            _write_state()

    @dbus.service.method("org.freedesktop.ScreenSaver",
                         in_signature="", out_signature="b")
    def GetActive(self):
        return dbus.Boolean(False)

    @dbus.service.method("org.freedesktop.ScreenSaver",
                         in_signature="", out_signature="u")
    def GetActiveTime(self):
        return dbus.UInt32(0)

    @dbus.service.method("org.freedesktop.ScreenSaver",
                         in_signature="b", out_signature="")
    def SetActive(self, active):
        pass


# ---- org.freedesktop.portal.Settings ----

class PortalSettings(dbus.service.Object):
    """
    Minimal org.freedesktop.portal.Settings implementation.

    GTK4/libadwaita apps read the color-scheme setting via this portal
    interface. The browser writes the desired scheme to the bridge state
    file, and we emit SettingChanged when it changes.
    """
    def __init__(self, bus):
        super().__init__(bus, "/org/freedesktop/portal/desktop")
        self._prev_scheme = _color_scheme

    @dbus.service.method("org.freedesktop.portal.Settings",
                         in_signature="ss", out_signature="v")
    def Read(self, namespace, key):
        if namespace == "org.freedesktop.appearance" and key == "color-scheme":
            return dbus.UInt32(_color_scheme)
        raise dbus.exceptions.DBusException(
            "org.freedesktop.portal.Error.NotFound",
            f"Setting {namespace}.{key} not found",
        )

    @dbus.service.method("org.freedesktop.portal.Settings",
                         in_signature="", out_signature="a{sa{sv}}")
    def ReadAll(self, *_args):
        return dbus.Dictionary({
            "org.freedesktop.appearance": dbus.Dictionary({
                "color-scheme": dbus.UInt32(_color_scheme),
            }, signature="sv"),
        }, signature="sa{sv}")

    @dbus.service.signal("org.freedesktop.portal.Settings",
                         signature="ssv")
    def SettingChanged(self, namespace, key, value):
        pass

    def check_and_emit(self):
        """Called periodically to detect color-scheme changes from Node.js."""
        if _color_scheme != self._prev_scheme:
            self._prev_scheme = _color_scheme
            self.SettingChanged(
                "org.freedesktop.appearance",
                "color-scheme",
                dbus.UInt32(_color_scheme),
            )


# ---- .desktop file monitor (inotify) ----

# inotify constants
IN_CREATE = 0x00000100
IN_DELETE = 0x00000200
IN_MODIFY = 0x00000002
IN_MOVED_TO = 0x00000080
IN_MOVED_FROM = 0x00000040
IN_MASK = IN_CREATE | IN_DELETE | IN_MODIFY | IN_MOVED_TO | IN_MOVED_FROM

_EVENT_HEADER = struct.Struct("iIII")  # wd, mask, cookie, len


def _setup_desktop_monitor():
    """Watch .desktop directories with inotify, integrated into the GLib loop."""
    global _apps_generation

    homedir = os.path.expanduser("~")
    watch_dirs = [
        os.path.join(homedir, "Desktop"),
        os.path.join(homedir, ".local/share/applications"),
        "/usr/share/applications",
        "/usr/local/share/applications",
    ]

    try:
        libc_name = ctypes.util.find_library("c")
        libc = ctypes.CDLL(libc_name or "libc.so.6", use_errno=True)
    except OSError:
        print("[sandbox-bridge] Could not load libc, desktop monitor disabled", file=sys.stderr)
        return

    ifd = libc.inotify_init1(0x00800)  # IN_NONBLOCK
    if ifd < 0:
        print("[sandbox-bridge] inotify_init1 failed, desktop monitor disabled", file=sys.stderr)
        return

    for d in watch_dirs:
        try:
            os.makedirs(d, exist_ok=True)
        except OSError:
            pass
        wd = libc.inotify_add_watch(ifd, d.encode(), IN_MASK)
        if wd >= 0:
            print(f"[sandbox-bridge] Watching {d}", file=sys.stderr)

    _debounce_source = [None]

    def _on_debounce():
        global _apps_generation
        _debounce_source[0] = None
        with _state_lock:
            _apps_generation += 1
            _write_state()
        print(f"[sandbox-bridge] Desktop entries changed (gen={_apps_generation})", file=sys.stderr)
        return False  # one-shot

    def _on_inotify_readable(fd, condition):
        try:
            buf = os.read(fd, 4096)
        except OSError:
            return True
        # Check if any event is for a .desktop file
        has_desktop = False
        offset = 0
        while offset < len(buf):
            wd, mask, cookie, name_len = _EVENT_HEADER.unpack_from(buf, offset)
            offset += _EVENT_HEADER.size
            name = buf[offset:offset + name_len].rstrip(b"\\x00").decode(errors="replace")
            offset += name_len
            if name.endswith(".desktop"):
                has_desktop = True
                break
        if has_desktop:
            if _debounce_source[0] is not None:
                GLib.source_remove(_debounce_source[0])
            _debounce_source[0] = GLib.timeout_add(500, _on_debounce)
        return True  # keep watching

    GLib.io_add_watch(ifd, GLib.IO_IN, _on_inotify_readable)
    print("[sandbox-bridge] Desktop entry monitor active", file=sys.stderr)


# ---- Main ----

def _poll_state_file(portal_settings):
    """Periodically re-read the state file for settings updates from Node.js."""
    _read_state()
    portal_settings.check_and_emit()
    return True  # keep the GLib timeout alive


def main():
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

    # Wait for the D-Bus socket to appear (it's started by xpra-start.sh)
    socket_path = os.environ.get("DBUS_SESSION_BUS_ADDRESS", "").replace("unix:path=", "")
    if socket_path:
        for _ in range(40):
            if os.path.exists(socket_path):
                break
            time.sleep(0.25)

    bus = dbus.SessionBus()

    # Claim bus names
    name_flags = dbus.bus.NAME_FLAG_REPLACE_EXISTING | dbus.bus.NAME_FLAG_DO_NOT_QUEUE
    for bus_name in [
        "org.freedesktop.Notifications",
        "org.freedesktop.ScreenSaver",
        "org.freedesktop.portal.Desktop",
    ]:
        ret = bus.request_name(bus_name, name_flags)
        if ret in (dbus.bus.REQUEST_NAME_REPLY_PRIMARY_OWNER,
                   dbus.bus.REQUEST_NAME_REPLY_ALREADY_OWNER):
            print(f"[sandbox-bridge] Claimed {bus_name}", file=sys.stderr)
        else:
            print(f"[sandbox-bridge] WARNING: could not claim {bus_name} (ret={ret})",
                  file=sys.stderr)

    # Instantiate service objects
    notif_daemon = NotificationDaemon(bus)
    screensaver = ScreenSaverInhibitor(bus)
    portal_settings = PortalSettings(bus)

    # Write initial state
    _write_state()

    # Poll for settings changes from Node.js every 2s
    GLib.timeout_add_seconds(2, _poll_state_file, portal_settings)

    # Watch .desktop directories for new/removed apps
    _setup_desktop_monitor()

    print("[sandbox-bridge] Running", file=sys.stderr)

    loop = GLib.MainLoop()

    def _shutdown(*_):
        loop.quit()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        loop.run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
`;
}

export function getXpraStartScript(): string {
  return `#!/bin/bash
# Start D-Bus session daemon on a well-known socket so all desktop processes
# (Xpra, notify-send, GTK apps, sandbox-bridge) share the same session bus.
SOCKET="${DBUS_SOCKET_PATH}"
rm -f "$SOCKET"

dbus-daemon --session --nofork --address="unix:path=$SOCKET" &
DBUS_PID=$!

# Wait for socket to appear
for i in $(seq 1 20); do
  [ -S "$SOCKET" ] && break
  sleep 0.1
done

export DBUS_SESSION_BUS_ADDRESS="unix:path=$SOCKET"

# No systemd in this environment (PM2 is the process manager).
# Tell GLib/GIO not to create systemd transient scopes for child processes.
# Without this, GNOME apps like Ptyxis fail with:
#   "Failed to start transient scope unit: Process org.freedesktop.systemd1
#    exited with status 1"
export GIO_USE_SYSTEMD=0

# Notifications are handled by the sandbox-bridge daemon (separate pm2 process)
# which claims org.freedesktop.Notifications on the session bus and writes
# to a shared JSON file that the Node.js service exposes via HTTP.
# Xpra still gets --notifications=yes so it can forward notifications from
# X11 apps that use Xpra's internal notification mechanism.

exec xpra start ${XPRA_DISPLAY} \\
  --bind-ws=0.0.0.0:${PORTS.XPRA} \\
  --html=on \\
  --sharing=yes \\
  --no-daemon \\
  --systemd-run=no \\
  --notifications=yes \\
  --webcam=no \\
  --pulseaudio=no \\
  --speaker=no \\
  --microphone=no
`;
}


