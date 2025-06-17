# Automated NPM Publishing Setup

This repository is configured for automated npm publishing using GitHub Actions. Here's how it works and how to use it.

## 🚀 How It Works

We have two GitHub Actions workflows set up:

1. **Release-based Publishing** (`.github/workflows/publish.yml`)
   - Triggers when you create a GitHub release
   - Automatically publishes to npm

2. **Tag-based Publishing** (`.github/workflows/publish-on-tag.yml`)
   - Triggers when you push a version tag (e.g., `v4.0.3`)
   - Automatically publishes to npm

## 🔧 Setup Requirements

### 1. NPM Token Setup

You need to add your NPM authentication token to GitHub Secrets:

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Go to your profile → Access Tokens
3. Generate a new **Automation** token
4. In your GitHub repository, go to Settings → Secrets and variables → Actions
5. Add a new secret named `NPM_TOKEN` with your token value

### 2. Repository Permissions

Ensure your GitHub repository has the following permissions:
- Actions: Read and write permissions
- Contents: Write permissions (for creating releases/tags)

## 📦 Publishing Methods

### Method 1: Using the Release Script (Recommended)

Use the provided release script for a streamlined process:

```bash
# Patch version (4.0.2 → 4.0.3)
npm run release:patch

# Minor version (4.0.2 → 4.1.0)
npm run release:minor

# Major version (4.0.2 → 5.0.0)
npm run release:major

# Default (patch)
npm run release
```

The script will:
1. Check you're on the main branch
2. Ensure working directory is clean
3. Pull latest changes
4. Update version in package.json
5. Prompt you to update CHANGELOG.md
6. Commit changes
7. Create and push a version tag
8. Trigger automatic npm publishing

### Method 2: Manual Tag Creation

```bash
# Update version manually
npm version patch  # or minor, major

# Push changes and tags
git push origin main
git push origin --tags
```

### Method 3: GitHub Releases

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Create a new tag (e.g., `v4.0.3`)
4. Fill in release notes
5. Publish the release
6. GitHub Actions will automatically publish to npm

## 🔍 Monitoring

- Check the **Actions** tab in your GitHub repository to monitor publishing progress
- You'll receive email notifications if the publishing fails
- Check [npmjs.com](https://www.npmjs.com/package/@oriolrius/node-red-contrib-s7) to confirm successful publication

## 🛠️ Troubleshooting

### Common Issues:

1. **NPM_TOKEN not set**: Add the secret in GitHub repository settings
2. **Permission denied**: Ensure you have publish rights to the npm package
3. **Version already exists**: Make sure to increment the version number
4. **Tests failing**: Fix any test failures before publishing

### Manual Publishing (Fallback)

If automated publishing fails, you can still publish manually:

```bash
npm login
npm publish
```

## 📋 Checklist Before Publishing

- [ ] Update CHANGELOG.md with new features/fixes
- [ ] Ensure all tests pass
- [ ] Version number is correctly incremented
- [ ] NPM_TOKEN secret is configured
- [ ] Working directory is clean
- [ ] On main/master branch

## 🔄 Workflow Files

- `.github/workflows/publish.yml` - Release-based publishing
- `.github/workflows/publish-on-tag.yml` - Tag-based publishing
- `scripts/release.sh` - Automated release script