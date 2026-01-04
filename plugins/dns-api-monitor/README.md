# DNS & API Monitor Plugin

Monitor DNS CNAME changes and API endpoint responses in real-time with automatic change detection and history tracking.

## Features

### DNS Monitoring
- **CNAME Tracking**: Monitor DNS CNAME records for any domain
- **Change Detection**: Automatically detect when CNAME records change
- **History Tracking**: Keep a complete history of all CNAME changes
- **Manual Checks**: Trigger manual DNS checks on demand
- **Configurable Intervals**: Set custom check intervals per monitor

### API Monitoring
- **HTTP Methods**: Support for GET, POST, and PUT requests
- **Custom Headers**: Add custom headers (e.g., authentication tokens)
- **Request Body**: Include request body for POST/PUT requests
- **Response Hashing**: Detect changes using MD5 hash comparison
- **Status Tracking**: Monitor HTTP status codes
- **Change Detection**: Get notified when API responses change
- **History Tracking**: Keep a complete history of all response changes

### General Features
- **Real-time Updates**: Dashboard refreshes every 10 seconds
- **Periodic Background Monitoring**: Automatic checks run every minute
- **In-memory Storage**: Fast, lightweight storage (no database required)
- **Beautiful UI**: Modern glass-morphism design with Tailwind CSS
- **Change Statistics**: Track total number of changes per monitor

## Installation

The plugin is already installed. To use it:

1. **Install Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Restart Backend**:
   ```bash
   python main.py
   ```

3. **Access the Plugin**:
   - Open SuperDashboard in your browser
   - Click on "📡 Monitoring" in the sidebar

## Usage

### Adding a DNS Monitor

1. Click "Add Monitor" button
2. Select the "DNS Monitors" tab
3. Enter the domain to monitor (e.g., `example.com`)
4. Set check interval (default: 300 seconds)
5. Click "Add DNS Monitor"

The plugin will immediately check the CNAME record and start monitoring for changes.

### Adding an API Monitor

1. Click "Add Monitor" button
2. Select the "API Monitors" tab
3. Enter the API URL (e.g., `https://api.example.com/status`)
4. Select HTTP method (GET, POST, PUT)
5. (Optional) Add custom headers in JSON format:
   ```json
   {"Authorization": "Bearer your-token"}
   ```
6. (Optional) Add request body for POST/PUT
7. Set check interval (default: 300 seconds)
8. Click "Add API Monitor"

The plugin will immediately fetch the endpoint and start monitoring for response changes.

### Manual Checks

Click the "⟳ Check Now" button on any monitor to trigger an immediate check, bypassing the normal check interval.

### Viewing History

Click on "History" to expand and view all detected changes for a monitor. History includes:
- **DNS**: Old and new CNAME values with timestamps
- **API**: Old and new content hashes with HTTP status codes

### Deleting Monitors

Click the "Delete" button to remove a monitor. This action cannot be undone.

## API Endpoints

### DNS Monitors

- `POST /plugins/dns-api-monitor/dns-monitors` - Add DNS monitor
- `GET /plugins/dns-api-monitor/dns-monitors` - List all DNS monitors
- `DELETE /plugins/dns-api-monitor/dns-monitors/{id}` - Delete DNS monitor
- `GET /plugins/dns-api-monitor/dns-monitors/{id}/history` - Get DNS monitor history
- `POST /plugins/dns-api-monitor/dns-monitors/{id}/check` - Trigger manual DNS check

### API Monitors

- `POST /plugins/dns-api-monitor/api-monitors` - Add API monitor
- `GET /plugins/dns-api-monitor/api-monitors` - List all API monitors
- `DELETE /plugins/dns-api-monitor/api-monitors/{id}` - Delete API monitor
- `GET /plugins/dns-api-monitor/api-monitors/{id}/history` - Get API monitor history
- `POST /plugins/dns-api-monitor/api-monitors/{id}/check` - Trigger manual API check

### Combined

- `GET /plugins/dns-api-monitor/monitors` - Get all monitors (DNS and API)

## Technical Details

### Backend
- **FastAPI Router**: Async endpoints for high performance
- **DNS Resolution**: Uses `dnspython` library for CNAME lookups
- **HTTP Client**: Uses `httpx` for async HTTP requests
- **Background Tasks**: Uses `asyncio` for periodic monitoring
- **Change Detection**: MD5 hashing for API responses, direct comparison for DNS

### Frontend
- **React**: Functional components with hooks
- **Real-time Updates**: Auto-refresh every 10 seconds
- **Responsive Design**: Works on desktop and mobile
- **Glass-morphism UI**: Modern, beautiful interface

### Data Storage
- **In-memory**: All data stored in Python dictionaries
- **No Persistence**: Data is lost when backend restarts
- **Fast**: No database queries or I/O overhead

## Use Cases

### DNS Monitoring
- Track CDN CNAME changes
- Monitor DNS propagation after changes
- Detect unauthorized DNS modifications
- Track DNS failover behavior

### API Monitoring
- Monitor API response changes
- Detect API version updates
- Track configuration endpoint changes
- Monitor third-party API stability
- Detect content changes on status pages

## Limitations

- **No Persistence**: Data is lost when backend restarts (consider adding database support for production)
- **In-memory Storage**: Limited by available RAM
- **No Alerts**: No email/SMS notifications (can be added in future versions)
- **CNAME Only**: Only monitors CNAME records, not A/AAAA/MX/TXT records
- **Simple Hash**: Uses MD5 for content comparison (consider SHA256 for security-sensitive applications)

## Future Enhancements

- [ ] Database persistence (PostgreSQL/MongoDB)
- [ ] Email/SMS/Webhook notifications
- [ ] Support for other DNS record types (A, AAAA, MX, TXT)
- [ ] Advanced API response comparison (JSON diff)
- [ ] Export history to CSV/JSON
- [ ] Configurable alert thresholds
- [ ] Dashboard widgets for other plugins
- [ ] Multi-region DNS checks
- [ ] Response time tracking
- [ ] Uptime monitoring

## License

MIT License - Same as SuperDashboard

## Author

Created for SuperDashboard Plugin System
