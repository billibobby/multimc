# 🔒 GitHub Repository Protection Guide

## 🛡️ How to Protect Your Repository from Unauthorized Changes

### 1. **Branch Protection Rules**

Go to your GitHub repository: `https://github.com/billibobby/multimc`

**Steps:**
1. Click on **"Settings"** tab
2. Click on **"Branches"** in the left sidebar
3. Click **"Add rule"** or **"Add branch protection rule"**
4. Set **"Branch name pattern"** to `main`
5. Enable these protections:

#### ✅ **Required Settings:**
- [x] **"Require a pull request before merging"**
- [x] **"Require approvals"** (set to 1 or more)
- [x] **"Dismiss stale PR approvals when new commits are pushed"**
- [x] **"Require review from code owners"**
- [x] **"Restrict pushes that create files"**
- [x] **"Require status checks to pass before merging"**
- [x] **"Require branches to be up to date before merging"**
- [x] **"Do not allow bypassing the above settings"**

#### ✅ **Additional Protections:**
- [x] **"Restrict deletions"**
- [x] **"Require linear history"**
- [x] **"Include administrators"**

### 2. **Repository Settings**

**Go to Settings → General:**

#### ✅ **Danger Zone:**
- [x] **"Restrict repository creation"** - Only you can create repositories
- [x] **"Disable issues"** - If you don't want issue reports
- [x] **"Disable wiki"** - If you don't want wiki pages
- [x] **"Disable projects"** - If you don't want project boards

#### ✅ **Features:**
- [x] **"Issues"** - Disable if you don't want bug reports
- [x] **"Wikis"** - Disable if you don't want documentation changes
- [x] **"Allow forking"** - Disable to prevent forks
- [x] **"Allow public access"** - Keep enabled for public viewing

### 3. **Collaborator Management**

**Go to Settings → Collaborators:**

#### ✅ **No Collaborators:**
- Remove any existing collaborators
- Don't add anyone as a collaborator
- Only you should have write access

### 4. **Code Owners File**

Create a `.github/CODEOWNERS` file:

```bash
# Create the directory
mkdir -p .github

# Create the CODEOWNERS file
echo "* @billibobby" > .github/CODEOWNERS
```

This ensures only you can approve changes.

### 5. **Security Settings**

**Go to Settings → Security:**

#### ✅ **Security Features:**
- [x] **"Dependency graph"** - Enable for security scanning
- [x] **"Dependabot alerts"** - Enable for vulnerability notifications
- [x] **"Code scanning"** - Enable if available

### 6. **Actions Settings**

**Go to Settings → Actions → General:**

#### ✅ **Workflow Permissions:**
- [x] **"Allow GitHub Actions to create and approve pull requests"** - Disable
- [x] **"Read and write permissions"** - Set to "Read repository contents and packages permissions"

### 7. **Deploy Keys**

**Go to Settings → Deploy keys:**

#### ✅ **No Deploy Keys:**
- Remove any existing deploy keys
- Don't add new deploy keys unless absolutely necessary

### 8. **Webhooks**

**Go to Settings → Webhooks:**

#### ✅ **No Webhooks:**
- Remove any existing webhooks
- Don't add new webhooks unless you control them

## 🚫 **What This Prevents:**

- ✅ **Direct pushes to main branch**
- ✅ **Unauthorized pull request merges**
- ✅ **Fork-based contributions**
- ✅ **Issue spam**
- ✅ **Wiki vandalism**
- ✅ **Malicious actions**
- ✅ **Unauthorized collaborators**

## ✅ **What This Allows:**

- ✅ **Public viewing of your code**
- ✅ **Forking for personal use**
- ✅ **Issue reporting (if enabled)**
- ✅ **Starring and watching**
- ✅ **You to make all changes**

## 🔧 **Quick Commands to Apply Protection:**

```bash
# Create CODEOWNERS file
mkdir -p .github
echo "* @billibobby" > .github/CODEOWNERS

# Add and commit the protection file
git add .github/CODEOWNERS
git commit -m "🔒 Add CODEOWNERS for repository protection"
git push origin main
```

## 🎯 **Result:**

After applying these settings, your repository will be:
- **Publicly viewable** but **protected from changes**
- **Only you can modify** the code
- **Others can fork** but **cannot contribute back**
- **Secure from unauthorized access**

Your MultiMC Hub code is now safe and protected! 🛡️ 