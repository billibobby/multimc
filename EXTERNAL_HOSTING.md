# External Hosting Feature

## Overview

The External Hosting feature allows users who don't have port forwarding capabilities to host Minecraft servers through free external hosting services. This is perfect for users who:

- Don't have access to router settings
- Are behind a restrictive firewall
- Want to host servers without technical networking knowledge
- Need a quick solution for casual gaming sessions

## Supported Services

The application currently supports the following free hosting services:

### 1. Aternos
- **Website**: https://aternos.org
- **Max Players**: 20
- **Uptime**: Limited (auto-sleep when inactive)
- **Supported Types**: Vanilla, Spigot, Paper, Forge, Fabric
- **Features**: 
  - Free tier available
  - Auto-sleep functionality to save resources
  - Web-based control panel
  - Plugin support

### 2. Minehut
- **Website**: https://minehut.com
- **Max Players**: 10
- **Uptime**: Limited
- **Supported Types**: Vanilla, Spigot, Paper
- **Features**:
  - Free tier available
  - Easy-to-use dashboard
  - Basic plugin support

### 3. PloudOS
- **Website**: https://ploudos.com
- **Max Players**: 20
- **Uptime**: Limited
- **Supported Types**: Vanilla, Spigot, Paper, Forge
- **Features**:
  - Free tier available
  - Multiple server types
  - Web-based management

### 4. Server.pro
- **Website**: https://server.pro
- **Max Players**: 10
- **Uptime**: Limited
- **Supported Types**: Vanilla, Spigot, Paper
- **Features**:
  - Free tier available
  - Simple setup process
  - Basic management tools

## How It Works

### 1. Service Discovery
The application automatically detects available external hosting services and checks their status.

### 2. Smart Recommendations
Based on your server configuration (type, version, player count), the system recommends the best hosting service for your needs.

### 3. Setup Wizard
A step-by-step wizard guides you through:
- Configuring your server settings
- Selecting the best hosting service
- Following setup instructions for the chosen service

### 4. Account Management
Securely store your hosting service credentials locally for future use.

## Limitations

### Free Service Limitations
- **Limited Uptime**: Servers may go to sleep when inactive
- **Player Limits**: Usually 10-20 players maximum
- **Startup Time**: May take 2-5 minutes to start after being inactive
- **No Custom Plugins**: Limited to basic server types
- **Resource Restrictions**: Limited RAM and storage

### Recommendations
- Perfect for casual gaming sessions with friends
- Consider upgrading to paid plans for better performance
- Keep servers active by having players join regularly
- Use for testing or small communities

## Usage Guide

### Step 1: Access External Hosting
1. Open MultiMC Hub
2. Navigate to the "External Hosting" tab in the sidebar
3. Review available services and their features

### Step 2: Start Setup Process
1. Click "Start Setup Guide" button
2. Fill in your server configuration:
   - Server name
   - Server type (Vanilla, Spigot, Paper, etc.)
   - Minecraft version
   - Maximum players

### Step 3: Choose Hosting Service
1. Review the recommended service
2. Compare with other available options
3. Select the service that best fits your needs

### Step 4: Follow Setup Instructions
1. Create an account on the chosen service
2. Configure your server settings
3. Start your server
4. Share the connection details with friends

### Step 5: Manage Your Server
- Use the service's web dashboard to manage your server
- Monitor player activity
- Configure server settings
- Install plugins (if supported)

## Technical Details

### Architecture
- **ExternalHostingManager**: Core class managing external hosting services
- **Service Integration**: Modular design for easy addition of new services
- **Configuration Storage**: Secure local storage of service credentials
- **Status Monitoring**: Real-time service availability checking

### API Integration
The system is designed to integrate with hosting service APIs (when available):
- Service status checking
- Server creation and management
- Player monitoring
- Configuration updates

### Security
- Credentials stored locally and encrypted
- No sensitive data transmitted to external services without user consent
- Secure communication with hosting service APIs

## Future Enhancements

### Planned Features
- Direct API integration with hosting services
- Automated server creation
- Real-time server monitoring
- Plugin management through the application
- Server backup and restore functionality

### Additional Services
- Support for more hosting providers
- Integration with premium hosting services
- Custom server configurations
- Advanced monitoring and analytics

## Troubleshooting

### Common Issues

**Service Not Available**
- Check your internet connection
- Verify the service website is accessible
- Try refreshing the service status

**Server Won't Start**
- Ensure you have an active account on the hosting service
- Check if the service is experiencing downtime
- Verify your server configuration is compatible

**Players Can't Connect**
- Check if the server is running on the hosting service
- Verify the connection details are correct
- Ensure the server hasn't gone to sleep (may need to wake it up)

### Getting Help
- Check the hosting service's documentation
- Visit the service's support forums
- Contact the hosting service's support team
- Review the application logs for error messages

## Contributing

To add support for new hosting services:

1. Update the `ExternalHostingManager` class
2. Add service configuration to `hostingServices`
3. Implement service-specific setup instructions
4. Add API integration (if available)
5. Update documentation

## License

This feature is part of the MultiMC Hub project and follows the same licensing terms. 