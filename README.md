# Unloading Tracker Dashboard

An invoice and unloading workflow dashboard developed for the **EFL 3PL · CSS Division**.

The application gives operations teams a shared view of invoice progress, AX/D365 processing stages and ASN updates. Authorized users manage records through the internal workspace, while a read-only overview provides searchable progress information without editing access.

## Contents

- [Overview](#overview)
- [Features](#features)
- [User roles](#user-roles)
- [Daily workflow](#daily-workflow)
- [Export invoices to Excel](#export-invoices-to-excel)
- [Delete an invoice](#delete-an-invoice)
- [Technology stack](#technology-stack)
- [Local development](#local-development)
- [Application routes](#application-routes)
- [Project structure](#project-structure)
- [Data and access](#data-and-access)
- [Development checks](#development-checks)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Unloading Tracker organizes invoice processing into one workspace so teams can find records, update progress and review the history of changes.

Each invoice can include its supplier, system, shipment type, document date, roll quantity and final status. Related processing stages and ASN information provide additional operational context.

The application has two entry points:

- **Invoice overview:** a searchable, read-only view of the information exposed by the overview endpoints.
- **Internal dashboard:** an authenticated workspace for managing invoices, processing progress and account access.

> The overview is accessible without signing in. Read-only access prevents editing; it does not make the displayed information private. Review the approved overview fields before exposing a deployment outside the organization.

## Features

### Invoice workspace

- Search invoices by invoice number or supplier.
- Filter records by Pending, Complete or Reject status.
- Use summary cards to select a status filter.
- Open an invoice by selecting its invoice number.
- Create invoices and edit their basic details.
- Track AX/D365 processing stages and ASN updates.
- Export invoices within a custom Document date range to an editable Excel workbook (administrators only).
- View paginated records and live update connection feedback.

### Read-only overview

- Display invoice totals and status summary cards.
- Search records and filter by status or system.
- View supplier, shipment, dates, quantities and processing information.
- View the ASN information exposed by the overview endpoint.
- Provide a route back to the dashboard for eligible signed-in users.

### Administration and account settings

- Permanently delete an invoice through an administrator-only confirmation dialog while retaining its activity history.
- Create standard user accounts.
- Activate or deactivate user access while preserving existing history.
- Search activity by invoice, actor, action type or date range.
- Expand activity rows to inspect recorded changes and previous/new values where available.
- Clear activity history through an administrator-only confirmation flow.
- View account identity and change the account password.

### Interface

- Shared workspace navigation and top bar.
- Collapsible sidebar and responsive layouts.
- Light and dark themes.
- Centered, responsive dialogs for invoice deletion and date-range export.
- Status colours with text labels.
- Search/filter navigation designed to preserve the shared workspace layout.
- Dates and times displayed in **Asia/Colombo (UTC+05:30)**.

## User roles

| Role | Access |
| --- | --- |
| Visitor | View and search the read-only invoice overview. |
| Active user (`USER`) | Access the invoice workspace and account settings, subject to server and database permissions. |
| Active administrator (`ADMIN`) | Access the invoice workspace, date-range Excel export, invoice deletion, user management and activity log administration. |
| Inactive account | Not permitted to use the protected workspace. |

Accounts are provisioned by an administrator. The application does not provide an open self-registration workflow.

## Daily workflow

1. **Find an invoice:** search the overview or sign in to the internal dashboard.
2. **Create a record:** an authorized user enters the invoice and supplier details.
3. **Update processing:** open the invoice number and record the applicable AX/D365 stages and ASN information.
4. **Maintain status:** update the invoice to the appropriate Pending, Complete or Reject state.
5. **Review progress:** use the table, summary cards and filters to locate outstanding work.
6. **Review history:** an administrator opens the activity log to inspect recorded actions and changes.

Summary cards show **all-time totals**, independent of the table filters. A card selection changes the table status filter; an existing search may still narrow the displayed results.

## Export invoices to Excel

**Available to active administrators.**

1. Open the dashboard and select **Export Excel**.
2. In the centered dialog, select any **From date** and **To date**.
3. Select **Download Excel** and check your browser downloads.

The range uses the invoice's **Document date** (`document_share_date`), not its creation or completion timestamp. Both dates are included. Selecting the same date in both fields exports that day's invoices.

- Includes every matching invoice across all result pages and statuses.
- Dashboard search, status filters and the current page do not restrict the export.
- Retains the existing 20-column workbook format, including AX/D365 stages, assigned users, ASN information, remarks and status.
- Keeps invoice numbers as text and leaves the workbook editable.
- Displays processing timestamps in Sri Lanka time.
- Names files `Unloading-Tracker_YYYY-MM-DD_to_YYYY-MM-DD.xlsx`.
- Shows a message when the range is invalid or contains no invoices.
- Allows up to **10,000 invoices per file**. There is no preset day-range restriction; if the record limit is exceeded, split the export into smaller date ranges.

The database records an `INVOICE_EXPORT_REQUESTED` event with the selected range and record count when a non-empty export dataset is prepared. This event records preparation, not confirmation that the browser saved the file.

## Delete an invoice

**Available to active administrators only. Deletion is permanent.**

1. Open the invoice's process page.
2. Select the **Delete invoice** trash icon beside the edit-details action.
3. Review the invoice number and supplier in the centered confirmation dialog.
4. Type the invoice number exactly as displayed.
5. Select **Delete invoice**. After a successful deletion, the application returns to the dashboard.

The operation removes the invoice and its related processing-stage and ASN records in one database transaction. Existing activity records remain, and an `INVOICE_DELETED` event stores the actor and a snapshot of the deleted data.

Activity records retain an invoice-number snapshot after deletion. Deleted invoices appear as text in the activity table rather than as links to a missing page. Invoice filtering in the activity log uses the number recorded at the time of the event.

Permissions are checked by both the server action and database function. If another user has updated the invoice since the page was opened, deletion is rejected until the administrator reloads and reviews the latest record. There is no restore action in the application.

## Technology stack

| Area | Technology |
| --- | --- |
| Application framework | Next.js App Router |
| Interface | React and TypeScript |
| Styling | Tailwind CSS and shared theme tokens |
| UI components and icons | shadcn/ui, Radix UI and Lucide React |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| Database access control | Row Level Security and database functions |
| Live updates | Supabase Realtime integration |
| Excel generation | ExcelJS |
| Theme switching | next-themes |

Use `web/package.json` and `web/package-lock.json` as the source of truth for dependency versions and scripts.

## Local development

### 1. Prerequisites

You need Git, Node.js compatible with the project's Next.js version, npm and access to the designated Supabase project.

Obtain the repository URL, approved environment values and an initial administrator account from the project maintainer. Use a development database for development work.

### 2. Clone and install

Clone the team repository:

```bash
git clone https://github.com/CSS-DEV-TEM/Unloading-tracker---Dashboard.git unloading-dashboard-work
cd unloading-dashboard-work/web
npm ci
```

### 3. Configure the environment

Create `web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-server-side-secret-key
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client key used with authentication and database access policies. |
| `SUPABASE_SECRET_KEY` | Server-only key used by administrative account provisioning. |

Never commit `.env.local` or real credentials. Do not add the `NEXT_PUBLIC_` prefix to the secret key or use it in browser code. Restart the development server after changing environment values.

### 4. Prepare database access

The web application expects its schema, policies and database functions to exist before it can operate.

For a new environment:

1. Ask the maintainer for the complete, current migration set.
2. Apply the project's Supabase migrations in filename order using the team's migration process.
3. Confirm the overview RPC functions, activity-clear function and `202610110001_invoice_delete_and_date_export.sql` are included. Apply the delete/export migration before using the corresponding updated UI.
4. Confirm the required Realtime configuration is enabled for the application's subscriptions.
5. Have the maintainer provision the first active administrator account.

For an existing team environment, use its approved configuration. Do not rerun setup SQL blindly against a shared or production database.

An authenticated account also needs a matching `profiles` record with the appropriate role and active status. Running `npm ci` does not create the database or administrator account.

### 5. Start the application

From `web/`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), or the address printed by the development server if that port is already in use.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Read-only invoice overview. |
| `/login` | Workspace sign-in. |
| `/dashboard` | Invoice summary, search, filters and records. |
| `/dashboard/invoices/[id]` | Invoice processing page. |
| `/dashboard/export` | Administrator-only POST endpoint for date-range Excel downloads; not a navigable page. |
| `/dashboard/users` | Administrator user management. |
| `/dashboard/activity` | Administrator activity log. |
| `/dashboard/settings` | Account identity and password settings. |

`[id]` represents an invoice's internal identifier.

## Project structure

The main areas are:

```text
web/
  src/
    app/
      page.tsx                 Read-only overview
      login/                   Sign-in page and actions
      dashboard/               Protected workspace
        invoices/              Invoice screens, update and delete actions
        export/                Date-range Excel download endpoint
        export-button.tsx      Export date-selection dialog
        users/                 User administration
        activity/              Activity filters and expandable records
        settings/              Account settings
    components/                Shared interface components
    lib/
      supabase/                Supabase client configuration
    proxy.ts                   Authentication session handling
  public/                      Static assets and branding
  package.json                 Dependencies and scripts
  package-lock.json            Locked dependency versions
supabase/
  migrations/                  Database schema, policies and functions
```

## Data and access

The primary tables include:

| Table | Responsibility |
| --- | --- |
| `profiles` | User names, roles and active access state. |
| `invoices` | Invoice identity, supplier, operational fields and status. |
| `pre_grn_stages` | System-specific processing progress. |
| `asn_updates` | ASN sharing and assignment information. |
| `activity_logs` | Recorded actors, actions, changes, timestamps and invoice-number snapshots. |

Protected operations rely on server-side authorization and database permissions. Hiding a button is not an authorization control.

The public overview uses dedicated database functions to expose a selected set of fields. Internal remarks, administrative history and other restricted data should not be added to those responses without review.

Invoice deletion retains audit history through `invoice_number_snapshot` and a nullable invoice reference. The `delete_invoice` function checks administrator access, confirmation and the expected invoice version. The `prepare_invoice_export_range` function validates the date range and returns a consistent dataset for workbook generation.

Clearing activity history is permanent and applies to all stored records, including those outside the current filters. The configured operation records who cleared the history and how many records were removed. Use this feature according to the organization's retention requirements.

## Development checks

Run these commands from `web/`:

```bash
npm run lint
npm run build
```

To run a completed production build locally:

```bash
npm run start
```

Before submitting a change, check the affected workflow as well as:

- Sign-in and active/inactive account behaviour.
- Invoice search, status cards, reset and pagination.
- Invoice creation and processing updates where relevant.
- Administrator-only routes and actions, including rejected delete/export requests from non-admin accounts.
- Delete confirmation, stale-version rejection and retained history using a disposable test invoice.
- Export date boundaries, same-day exports, empty ranges and the record limit.
- Centered export/delete dialogs, keyboard dismissal and small-screen scrolling.
- Light/dark themes and narrow-screen layouts.
- Filter navigation without an unexpected sidebar reset.
- Read-only behaviour of the public overview.

A successful build does not replace workflow and permission testing against the intended database.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Sign-in succeeds but workspace access is unavailable | Confirm the matching profile, role and `is_active` value. |
| Administrator cannot create a user | Confirm the server-only secret key and account-provisioning migrations. |
| Overview cannot load invoice data | Check the overview RPC functions, grants and Supabase configuration. |
| Search reloads the entire page or resets the sidebar | Check that search forms use Next.js `Form` navigation and retain the shared dashboard layout. |
| Activity results do not match the expected date | Filters use Sri Lanka dates; the To date includes the full selected day. |
| A summary total differs from the visible rows | Summary totals are all-time; search, status filters and pagination affect the table. |
| Delete or date-range export fails after an update | Confirm the delete/export migration has been applied and the signed-in profile is an active administrator. |
| Deletion reports that the invoice changed | Reload the invoice and review the latest details before confirming again. |
| A deleted invoice is still visible in the activity log | This is expected: audit history is retained, while the original invoice and its processing records are removed. |
| No invoices are found for an export | Check Document dates, not creation dates, and confirm the selected range. |
| Excel contains records outside the dashboard search results | Export uses only the selected Document date range; table filters are independent. |
| Export exceeds 10,000 invoices | Split the range into smaller date ranges. No partial workbook is returned. |
| Live updates are disconnected | Check network connectivity and the project's Realtime configuration. |
| New environment values are not taking effect | Restart the application server after editing `.env.local`. |

## Contributing

1. Pull the latest team-approved base branch.
2. Work on your assigned developer branch or a feature branch.
3. Keep changes focused and preserve existing authorization checks.
4. Include a versioned migration with database changes.
5. Run lint/build checks and verify the affected workflow.
6. Open a pull request describing the problem, change and validation performed.

Do not commit credentials, real customer exports or unnecessary personal information. Use synthetic data in screenshots and examples.

## Ownership and support

Developed for **EFL 3PL · CSS Division**.

For account access, contact the dashboard administrator. For defects, provide the affected page, reproduction steps, expected result and a screenshot with sensitive information removed.

No open-source license is declared in this README. Confirm repository ownership and distribution permissions with the project owner before sharing the code externally.
