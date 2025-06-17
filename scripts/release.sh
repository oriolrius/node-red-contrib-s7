#!/bin/bash

# Release script for automated npm publishing
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Default to patch if no argument provided
VERSION_TYPE=${1:-patch}

echo "🚀 Starting release process..."

# Ensure we're on main/master branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    echo "❌ Please switch to main/master branch before releasing"
    exit 1
fi

# Ensure working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin $CURRENT_BRANCH

# Update version in package.json
echo "📝 Updating version..."
npm version $VERSION_TYPE --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ Updated to version $NEW_VERSION"

# Update CHANGELOG.md (you can customize this part)
echo "📋 Please update CHANGELOG.md with the new version changes"
echo "Press Enter when ready to continue..."
read

# Commit changes
echo "💾 Committing changes..."
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: bump version to $NEW_VERSION"

# Create and push tag
echo "🏷️  Creating and pushing tag..."
git tag "v$NEW_VERSION"
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

echo "🎉 Release process completed!"
echo "📦 The GitHub Action will automatically publish to npm when the tag is pushed."
echo "🔗 Check the Actions tab in your GitHub repository for progress."