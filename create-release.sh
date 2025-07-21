#!/bin/bash

# 🚀 MultiMC Hub - Release Creator
# This script helps you create new releases easily

echo "🚀 MultiMC Hub - Release Creator"
echo "=================================="
echo ""

# Check if version is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a version number"
    echo ""
    echo "Usage: ./create-release.sh v1.0.0"
    echo "Example: ./create-release.sh v1.1.0"
    echo ""
    echo "This will:"
    echo "1. Create a new version tag"
    echo "2. Push the tag to GitHub"
    echo "3. Trigger automatic release creation"
    echo "4. Build installers for all platforms"
    echo ""
    exit 1
fi

VERSION=$1

echo "📋 Release Information:"
echo "  Version: $VERSION"
echo "  Repository: billibobby/multimc"
echo "  Owner: @billibobby"
echo ""

# Confirm release
read -p "🤔 Are you sure you want to create release $VERSION? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 1
fi

echo ""
echo "🔧 Creating release $VERSION..."

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're not on the main branch (currently on $CURRENT_BRANCH)"
    read -p "🤔 Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Release cancelled"
        exit 1
    fi
fi

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes"
    git status --short
    echo ""
    read -p "🤔 Commit changes before creating release? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📝 Committing changes..."
        git add .
        git commit -m "🔧 Prepare for release $VERSION"
        git push origin main
    else
        echo "❌ Please commit or stash your changes before creating a release"
        exit 1
    fi
fi

# Create and push tag
echo "🏷️  Creating version tag $VERSION..."
git tag $VERSION

echo "📤 Pushing tag to GitHub..."
git push origin $VERSION

echo ""
echo "✅ Release process started!"
echo ""
echo "📋 What happens next:"
echo "1. GitHub Actions will automatically:"
echo "   - Build the application"
echo "   - Create installers for all platforms"
echo "   - Create a new release on GitHub"
echo "   - Upload all files to the release"
echo ""
echo "2. Users can download the update from:"
echo "   https://github.com/billibobby/multimc/releases"
echo ""
echo "3. The repository remains protected:"
echo "   - No external changes allowed"
echo "   - Only you can modify the code"
echo "   - Users get updates without access to source"
echo ""
echo "🔗 Monitor the release process:"
echo "   https://github.com/billibobby/multimc/actions"
echo ""
echo "🎉 Release $VERSION is being created automatically!" 