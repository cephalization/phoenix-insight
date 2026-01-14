# Troubleshooting

This guide covers common issues and their solutions when using Phoenix Insight CLI.

## Connection Issues

```bash
# Test connection to Phoenix
phoenix-insight snapshot

# If that fails, check your Phoenix instance:
curl http://localhost:6006/v1/projects

# Verify with explicit connection:
phoenix-insight snapshot --base-url http://your-phoenix:6006
```

If you're running Phoenix in Docker or on a remote server, ensure:
- The port is accessible from your machine
- No firewall rules are blocking the connection
- The URL includes the correct protocol (`http://` or `https://`)

## Authentication Errors

```bash
# Set API key via environment
export PHOENIX_API_KEY="your-key"
phoenix-insight "your query"

# Or pass directly
phoenix-insight "your query" --api-key "your-key"
```

If authentication continues to fail:
- Verify the API key is correct and hasn't expired
- Check if your Phoenix instance requires authentication
- Ensure the key has the necessary permissions

## Debug Mode

For detailed error information:

```bash
# Enable debug output
DEBUG=1 phoenix-insight "problematic query"

# This shows:
# - Full stack traces
# - API request details
# - Agent tool calls
# - Raw responses
```

Debug mode is useful for:
- Diagnosing connection problems
- Understanding why queries aren't returning expected results
- Reporting issues with detailed context

## Common Issues

### "No snapshot found" in local mode

```bash
# Create initial snapshot
phoenix-insight snapshot

# Or use --refresh to create on-demand
phoenix-insight "query" --refresh
```

### Out of memory in sandbox mode

```bash
# Reduce span limit
phoenix-insight "query" --sandbox --limit 500

# Or use local mode for large datasets
phoenix-insight "query" --local
```

### Local storage getting too large

```bash
# Check what will be deleted
phoenix-insight prune --dry-run

# Clean up all local snapshots
phoenix-insight prune
```

### Agent can't find expected data

```bash
# Force refresh to get latest
phoenix-insight "query" --refresh

# Fetch more data on-demand (agent will do this automatically)
px-fetch-more spans --project my-project --limit 2000
```

### Slow queries

- **In sandbox mode**: Reduce `--limit` to fetch fewer spans
- **In local mode**: Consider using incremental updates instead of full refresh
- **Complex analysis**: Enable `--stream` to see progress in real-time

### Phoenix instance returns errors

Check that your Phoenix instance is healthy:

```bash
# Check Phoenix health
curl http://localhost:6006/v1/projects

# Check available projects
phoenix-insight snapshot --base-url http://localhost:6006
```

### Agent produces unexpected results

- Try rephrasing your query to be more specific
- Use `--refresh` to ensure you have the latest data
- Enable debug mode (`DEBUG=1`) to see what the agent is doing
- Check `_context.md` in the snapshot to see what data is available

## Getting Help

If you continue to experience issues:

1. Enable debug mode and capture the output
2. Check the [GitHub issues](https://github.com/cephalization/phoenix-insight/issues) for similar problems
3. File a new issue with:
   - Your Phoenix Insight version (`phoenix-insight --version`)
   - Phoenix instance version
   - Debug output
   - Steps to reproduce
