# Garmin Coach — React Native Android app

The same cycling-coach experience as the .NET MAUI app in `app/GarminCoach`, rebuilt in React
Native. Enter your own Garmin personal API key and AI provider key on the device, tap
**What should I ride today?**, and the app reads the last 7 days of your Garmin data through the
read-only Garmin MCP server, shows every tool call it made, and asks the chosen AI model for
exactly one cycling session.

The app only ever calls the server's read-only Garmin tools. The Garmin key is sent only to the
Garmin MCP server; the AI key is sent only to the AI provider. Neither key appears in logs, error
messages or the tool-call trace.

## What lives here

| Path | What it is |
| --- | --- |
| `src/coach/` | The shared coach module: Garmin payload reading, signal summaries (with no-data handling), the AI prompt, reply parsing and validation, the read-only tool catalog. Covered by unit tests. |
| `src/garmin/mcpClient.ts` | A hand-rolled Streamable HTTP MCP client that posts JSON-RPC to `<server address>/mcp` with the `X-Garmin-Api-Key` header. |
| `src/settings/` | Settings storage: the two keys in Keystore-backed encrypted storage (`react-native-keychain`), the three other settings in `@react-native-async-storage/async-storage`. |
| `src/screens/` | The Home screen (coach action, Settings link, Test connection, signal summaries, tool-call trace, the one recommendation) and the Settings screen. |
| `android/` | The bare React Native Android project. Application id `com.garmincoach.reactnative`. |

## Start the Garmin MCP server in HTTP mode

The server serves the same 21 read-only tools over Streamable HTTP so a phone or emulator can
reach them. In that mode it takes the Garmin key from the `X-Garmin-Api-Key` request header
rather than from the process environment.

```sh
uv sync --extra http            # or: pip install "garmin-mcp[http]"
uv run garmin-mcp http          # listens on 127.0.0.1:8000 by default
```

It binds to `127.0.0.1` unless you explicitly widen it. To reach it from another machine you must
opt in by setting the bind address yourself, for example
`GARMIN_MCP_HTTP_HOST=0.0.0.0 uv run garmin-mcp http`. The health endpoint is
`http://127.0.0.1:8000/health` and reports the tool count.

The app appends `/mcp` to the address you enter, so the default `http://10.0.2.2:8000` posts to
`http://10.0.2.2:8000/mcp`.

## Run the app on an Android emulator

Prerequisites: Node.js 22.11 or later, a JDK 17+, and Android Studio with an emulator running
(Android 7.0 / API 24 or newer).

```sh
cd app/ReactNativeCoach
npm ci
npm run android         # builds and installs on the running emulator
```

The first build also needs Metro; `npm start` starts it on its own if the CLI does not.

In a fresh install the server address is `http://10.0.2.2:8000`, which is how the Android emulator
reaches a server running on your development machine. Open **Settings**, paste your Garmin personal
API key and your OpenAI or Anthropic key, pick the provider and model, and tap **Save**. Tap
**Test connection** to see the address and how many read-only tools the server offers.

Cleartext HTTP is allowed only for `10.0.2.2`, `localhost` and `127.0.0.1`
(`android/app/src/main/res/xml/network_security_config.xml`); anything else must use HTTPS.

## Point the app at a server on another host

Start the server so that it accepts connections from the network (this is an explicit opt-in):
`GARMIN_MCP_HTTP_HOST=0.0.0.0 uv run garmin-mcp http`. Then in the app open **Settings**, change
**Garmin MCP server address** to the machine's address and port (for example
`http://192.168.1.20:8000`), tap **Save**, and tap **Test connection**.

If the host is not `10.0.2.2` or `localhost`, use `https://` unless you also add that host to the
network security config and rebuild the app.

## Tests

```sh
npm ci
npm run typecheck       # tsc --noEmit
npm run test:ci         # Jest in CI mode, writes test-results/junit.xml and coverage/cobertura-coverage.xml
```

`test-results/` and `coverage/` are generated and git-ignored.