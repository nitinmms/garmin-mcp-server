# Garmin MCP Server

A read-only [MCP](https://modelcontextprotocol.io) server that lets an AI agent query **your own**
Garmin Connect data through Garmin's official
[Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api/).

## 1. Create a personal API key

1. Sign in to Garmin Connect Web and open
   <https://connect.garmin.com/app/settings/personalApiToken>.
2. **Create Key**, accept the terms, pick an expiry (30 days – 1 year), and copy the key.
   It is shown only once — treat it like a password.

The server exchanges the key for a 24-hour access token and renews it automatically.
When the key itself expires (Garmin emails you a week ahead), create a new one and update your config.

## 2. Install and verify

Requires [uv](https://docs.astral.sh/uv/) and Python 3.11+.

```sh
cd c:\temp\garmin-mcp-server
uv sync
```

Check the key works (prints only field counts, no personal data):

```powershell
$env:GARMIN_PERSONAL_API_KEY = "<your key>"; uv run garmin-mcp check
```

## 3. Connect an MCP client

### Claude Code

```sh
claude mcp add garmin --scope user -e GARMIN_PERSONAL_API_KEY=<your key> -- uv --directory c:\temp\garmin-mcp-server run garmin-mcp
```

Then run `/mcp` in Claude Code to confirm `garmin` is connected.

### Any other MCP client (stdio)

Most clients accept a JSON server entry like this:

```json
{
  "mcpServers": {
    "garmin": {
      "command": "uv",
      "args": ["--directory", "c:\\temp\\garmin-mcp-server", "run", "garmin-mcp"],
      "env": { "GARMIN_PERSONAL_API_KEY": "<your key>" }
    }
  }
}
```

## Tools

All tools are read-only. Dates are `YYYY-MM-DD`; a missing date means today.
Ranged tools accept up to 366 days and split requests to fit Garmin's per-call limits (28/31 days).
Tools marked † drop large intraday time series unless called with `include_samples=true`.

| Area | Tools |
|---|---|
| Activities | `search_activities`, `get_activity`, `get_activity_workouts` |
| Daily health | `get_daily_summary`, `get_daily_summaries`, `get_steps`, `get_stress`, `get_heart_rate`†, `get_body_battery`†, `get_spo2`†, `get_hydration`, `get_wellness_activities` |
| Sleep & recovery | `get_sleep`, `get_sleep_summaries`, `get_hrv`†, `get_hrv_range`, `get_fitness_age` |
| Body & profile | `get_weight`, `get_weight_goals`, `get_heart_rate_zones`, `get_profile_settings` |

Not available in the Personal API (so not offered here): training readiness, training status,
VO2 max, personal records, and device lists.

## Sample .NET MAUI app (Android)

`app/GarminCoach` is a Blazor Hybrid MAUI app that embeds this MCP server and coaches you:
it reads the last 7 days of your own Garmin data through the read-only tools, shows every
tool call it made, asks your chosen AI model for one cycling session, and sanity-checks the
answer. Its shared coach core ships as the `app/GarminCoach.Core` library.

```sh
uv sync                                   # Python server + its HTTP extra
dotnet build garmin-mcp-server.slnx       # the app, its core and the .NET tests
dotnet test app/GarminCoach.Core.Tests    # the .NET unit tests
```

In the app, open **Settings**, paste your Garmin personal API key and your OpenAI or
Anthropic key, then tap **What should I ride today?**. The app talks to the MCP server over
the Streamable HTTP transport (`garmin-mcp http`); on the Android emulator it reaches this
machine at `http://10.0.2.2:8000`. Point it at another address in Settings if your server
runs elsewhere.

### Android deploys with "not enough space"

If deployment to the emulator stops with

```
ADB0010: Mono.AndroidTools.InstallFailedException: ... Requested internal only, but not enough space
```

the emulator's internal data partition is too small for a MAUI debug build, and Android's
default is to install to internal storage only. `app/GarminCoach/GarminCoach.csproj` sets
`AndroidInstallLocation` to `auto`, which lets the system fall back to external storage. If it
still fails, free space in the emulator with `adb shell pm uninstall com.garmincoach.sample`,
or recreate the AVD with a larger internal storage (Device Manager -> Wipe Data / edit disk size).

## Security notes

- The key is read only from the `GARMIN_PERSONAL_API_KEY` environment variable and is never logged
  or included in error messages.
- Revoke access at any time by deleting the key on Garmin Connect Web.
- The Personal API is licensed for personal use with your own data only.

## Development

```sh
uv run pytest
```

## License

Licensed under the [Apache License 2.0](LICENSE).
