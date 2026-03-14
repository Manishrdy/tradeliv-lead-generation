# TradeLiv Lead Generation

This is the landing page and early access waitlist for TradeLiv, a B2B sourcing platform for Interior Designers and Furniture Brands.

## Architecture

This is a completely serverless frontend application. It relies entirely on HTML, CSS, JavaScript, and a direct connection to a Supabase PostgreSQL database to capture leads.

### Key Technologies
- Pure HTML/CSS for structure and styling.
- Vanilla JavaScript for form validation, UI state (Dark/Light mode, Toast notifications), and Supabase interaction.
- **Supabase** (PostgreSQL) for storing captured leads and handling duplicate email prevention (via Database Unique Constraints).

## Local Development

1. Open your terminal and navigate to the project directory.
2. Since this project uses ES Modules and accesses `localStorage`, you must run it over a local server instead of opening the HTML file directly. Run:
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080` in your browser.

**Note on Database Access:**
Locally, the application expects a `config.js` file at the root containing your Supabase credentials:
```javascript
const SUPABASE_URL = 'https://[YOUR_PROJECT_ID].supabase.co';
const SUPABASE_ANON_KEY = '[YOUR_ANON_KEY]';
```
*This file is ignored by git to prevent committing secrets to the repository.* Use `config.example.js` as a template.

## Deployment

This site is automatically deployed to **GitHub Pages** via GitHub Actions. 

Because `config.js` is correctly git-ignored, the GitHub Actions workflow dynamically injects the Supabase credentials during the build step.

### Requirements for Deployment:
To deploy this successfully, you must have the following **Repository Secrets** configured in your GitHub repository (`Settings` > `Secrets and variables` > `Actions`):
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_ANON_KEY`: Your Supabase Anonymous Public Key.

*Note: Because this is a serverless architecture, these keys are intentionally exposed in the final browser bundle. You **MUST** ensure [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security) is enabled on your Supabase `leads` table, restricting anonymous users to only `INSERT` operations.*
