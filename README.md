# Unloading Tracker Dashboard

An invoice and unloading workflow dashboard developed for **EFL 3PL · CSS Division**.

The application gives operations teams a shared view of invoice progress, AX/D365 processing stages, ASN updates and vehicle assignments. Authorized users manage records through the internal workspace, while a searchable, read-only overview provides visibility without editing access.

## Contents

- [Overview](#overview)
- [Features](#features)
- [User roles](#user-roles)
- [Daily workflow](#daily-workflow)
- [Vehicle management](#vehicle-management)
- [Pending reasons](#pending-reasons)
- [Export invoices to Excel](#export-invoices-to-excel)
- [Delete an invoice](#delete-an-invoice)
- [Activity history](#activity-history)
- [Technology stack](#technology-stack)
- [Local development](#local-development)
- [Application routes](#application-routes)
- [Project structure](#project-structure)
- [Data and access](#data-and-access)
- [Development checks](#development-checks)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Ownership and support](#ownership-and-support)

## Overview

Unloading Tracker organizes invoice processing into one workspace so teams can find records, update progress, manage vehicle assignments and review changes.

Each invoice can include:

- Invoice number and supplier.
- Applicable system: AX, D365 or AX/D365.
- Shipment type: Local or Import.
- Document date and roll quantity.
- Optional vehicle number.
- Processing-stage and ASN information.
- Pending reason and internal remark.
- Final status: Pending, Complete or Reject.

The application has two entry points:

| Area | Purpose |
| --- | --- |
| Invoice overview | Searchable, read-only invoice visibility without signing in. |
| Internal dashboard | Authenticated workspace for invoice processing, vehicle management and administration. |

> The overview is accessible without signing in. Read-only access prevents editing but does not make the displayed information private. Confirm which fields are approved for public visibility before exposing a deployment outside the organization.

## Features

### Invoice workspace

- Search invoices by invoice number, supplier or vehicle number.
- Filter records by status.
- Select summary cards to apply a status filter.
- Open the process page by selecting an invoice number.
- Create invoices and edit their basic details.
- Select an existing vehicle or enter a new vehicle number.
- Display vehicle labels beneath invoice numbers and on the process page.
- Show pending reasons in the invoice table.
- Track AX/D365 processing stages and ASN updates.
- Export invoices within a custom Document date range.
- Navigate paginated results and view live-update connection feedback.

### Read-only overview

- Display invoice totals and status summary cards.
- Search by invoice number, supplier or vehicle number.
- Filter records by status or system.
- Display vehicle labels and operational progress.
- Highlight pending invoices that have a pending reason.
- Open the pending-reason control to read the full explanation.
- View supplier, shipment, dates, quantities and exposed ASN information.
- Provide a route back to the dashboard for eligible signed-in users.

### Vehicle management

- Maintain a shared vehicle registry.
- Search vehicles and view their assigned invoice counts.
- Assign existing invoices individually or in batches.
- Review current and proposed assignments before confirmation.
- Reassign invoices to another active vehicle.
- Remove vehicle assignments without deleting invoices.
- Automatically create or reuse vehicle records when saving invoice details.
- Edit vehicle numbers with synchronized invoice labels.
- Archive vehicles while preserving existing invoice assignments.
- Restore archived vehicles for future assignments.
- Permanently delete vehicles that have no currently assigned invoices.
- Record vehicle changes in the activity log.

### Administration and account settings

- Create standard user accounts.
- Activate or deactivate access while preserving existing history.
- Permanently delete invoices through a confirmation flow.
- Export invoices by Document date range.
- Review and filter activity history.
- Inspect previous and updated values in activity records.
- Clear activity history through an administrator-only confirmation flow.
- View account identity and change the account password.

### Interface

- Shared workspace navigation and top bar.
- Collapsible sidebar.
- Responsive layouts.
- Light and dark themes.
- Centered dialogs for vehicle actions, invoice deletion and Excel export.
- Status colours accompanied by text labels.
- Filter navigation designed to preserve the shared workspace layout.
- Operational timestamps displayed in **Asia/Colombo (UTC+05:30)**.

## User roles

| Capability | Visitor | Active USER | Active ADMIN |
| --- | --- | --- | --- |
| View and search the public overview | Yes | Yes | Yes |
| Access the internal dashboard | No | Yes | Yes |
| Create and update invoices | No | Yes | Yes |
| Add vehicles | No | Yes | Yes |
| Assign, reassign and unassign invoices | No | Yes | Yes |
| Edit vehicle numbers | No | No | Yes |
| Archive and restore vehicles | No | No | Yes |
| Delete vehicles without assigned invoices | No | No | Yes |
| Export invoices to Excel | No | No | Yes |
| Permanently delete invoices | No | No | Yes |
| Manage users | No | No | Yes |
| View and administer activity history | No | No | Yes |
| Access own account settings | No | Yes | Yes |

Inactive accounts cannot use the protected workspace.

Accounts are provisioned by an administrator. The application does not provide open self-registration.

Permissions are enforced by server-side checks and database functions, not only by the visibility of interface controls.

## Daily workflow

1. **Find an invoice:** search the overview or sign in to the dashboard.
2. **Create a record:** enter the invoice and supplier details, optionally selecting or entering a vehicle number.
3. **Manage assignments:** use Vehicle management when several existing invoices need to be assigned to a vehicle.
4. **Update processing:** open the invoice and record applicable AX/D365 stages and ASN information.
5. **Maintain status:** set the appropriate Pending, Complete or Reject status and provide a pending reason where applicable.
6. **Review progress:** use summary cards, search and filters to locate outstanding work.
7. **Review history:** an administrator inspects the activity log when a change needs to be traced.

Summary cards show **all-time totals**, independent of the table filters. Selecting a card changes the table's status filter; an existing search may still narrow the displayed results.

## Vehicle management

Open **Vehicle management** from the workspace sidebar.

The page has two views:

| View | Contents |
| --- | --- |
| Active | Vehicles available for new invoice assignments. |
| Archived | Vehicles retained for reference and possible restoration. |

Select **View invoices** to see a vehicle's assigned invoices and available management actions.

An invoice has at most one current vehicle. A vehicle can have many invoices. The registry tracks current assignments rather than separate journeys or trips.

### Add a vehicle

1. Select **Add vehicle**.
2. Enter the vehicle number.
3. Select **Save vehicle**.

Vehicle numbers are limited to **30 characters**.

Matching ignores letter case, whitespace and hyphens. For example, `WP-ABC-1234` and `wp abc 1234` identify the same vehicle.

An existing active vehicle is reused rather than duplicated. An archived number remains reserved and must be restored before it can be used for a new assignment.

### Assign existing invoices

1. Find an active vehicle and select **View invoices**.
2. Select **Assign invoices**.
3. Search by invoice number, supplier or vehicle number.
4. Select up to **50 invoices** in one batch.
5. Select **Review selection**.
6. Check the current and proposed assignments.
7. Select **Confirm assignment**.

Selections are retained while searching or changing result pages.

Assigning an invoice that currently belongs to another vehicle moves it to the selected vehicle.

Assignment operations check invoice versions. If a selected invoice changes before confirmation, the batch is rejected without partially applying the assignments. Reload the latest records and review the selection again.

### Use vehicles during invoice creation or editing

The optional **Vehicle number** field offers active vehicle suggestions and accepts a new number.

When the invoice is saved:

- An existing active number reuses its vehicle record.
- A new number creates a vehicle record and assigns the invoice.
- A blank field leaves the invoice unassigned.
- Clearing an existing vehicle number removes the assignment.
- A new assignment to an archived number is rejected with a restore/select-another message.

New vehicle records are created when the invoice is saved, not while typing.

An invoice already linked to an archived vehicle can still have its other details edited while retaining that assignment.

### Edit a vehicle number

**Available to active administrators.**

1. Open the vehicle using **View invoices**.
2. Select **Edit vehicle**.
3. Correct the vehicle number.
4. Select **Save changes**.

The updated number appears on linked invoices in the dashboard, public overview and process page.

Other invoice details, such as invoice number, supplier and status, remain unchanged. The update is recorded in activity history, and linked invoice versions advance as their vehicle labels change.

A number matching another vehicle is rejected. Editing does not merge vehicle records.

### Remove an invoice assignment

1. Open the vehicle's invoice list.
2. Select **Unassign** beside the invoice.
3. Confirm **Remove assignment**.

The invoice remains in the dashboard. Its vehicle assignment and label are cleared.

Existing assignments can be removed from an archived vehicle or moved to an active vehicle.

### Archive a vehicle

**Available to active administrators.**

1. Open the vehicle using **View invoices**.
2. Select **Archive vehicle**.
3. Review the confirmation.
4. Confirm **Archive vehicle**.

Archiving:

- Removes the vehicle from the Active list.
- Removes it from suggestions for new assignments.
- Prevents new invoice assignments to that vehicle.
- Preserves existing invoice links and vehicle labels.
- Leaves existing invoice data and versions unchanged.
- Keeps the vehicle available in the Archived view.

Use Archive when a vehicle should no longer receive new assignments but its existing invoice relationships must remain.

### Restore an archived vehicle

**Available to active administrators.**

1. Open the **Archived** view.
2. Find the vehicle and select **View invoices**.
3. Select **Restore vehicle**.
4. Confirm the action.

The vehicle returns to the Active list and becomes available for new assignments. Existing invoice records remain unchanged.

### Delete a vehicle

**Available to active administrators only. Deletion is permanent.**

The **Delete vehicle** action is shown only when a vehicle has **zero currently assigned invoices**.

1. Open the vehicle using **View invoices**.
2. Select **Delete vehicle**.
3. Type the vehicle number exactly as displayed.
4. Confirm **Delete vehicle**.

The database rechecks assignments before deletion. If an invoice has been assigned since the dialog was opened, deletion is rejected.

Deleting a vehicle:

- Removes only the vehicle record.
- Does not delete invoices.
- Preserves existing activity history.
- Records a `VEHICLE_DELETED` event containing the vehicle number.

Vehicles with assigned invoices must be archived instead of deleted. There is no restore action for a permanently deleted vehicle.

### Vehicle search

Dashboard and overview search can locate invoices using the displayed vehicle number.

Vehicle registry matching ignores spaces and hyphens. Invoice-table search remains a text search, so use the displayed vehicle-number format when needed.

## Pending reasons

The dashboard displays **Pending reason** rather than the internal remark in the relevant table field.

On the public overview:

- A Pending invoice with a reason receives a visual highlight.
- The reason control opens the full explanation.
- Pending invoices without a reason do not show that indicator.

Pending reasons shown on the public overview are viewer-visible operational information. Keep internal-only notes in the appropriate internal field.

This display change does not remove remarks from the existing Excel export.

## Export invoices to Excel

**Available to active administrators.**

1. Open the dashboard and select **Export Excel**.
2. Select a **From date** and **To date** in the centered dialog.
3. Select **Download Excel**.
4. Check the browser's downloads.

The range uses the invoice's **Document date** (`document_share_date`), not its creation or completion timestamp.

Both boundary dates are included. Selecting the same date in both fields exports that day's invoices.

### Export behaviour

- Includes matching invoices across all result pages and statuses.
- Uses the selected Document date range independently of dashboard search and filters.
- Retains the existing 20-column workbook format.
- Includes AX/D365 stages, assigned users, ASN information, remarks and status.
- Keeps invoice numbers as text.
- Leaves the workbook editable.
- Displays processing timestamps in Sri Lanka time.
- Uses the filename `Unloading-Tracker_YYYY-MM-DD_to_YYYY-MM-DD.xlsx`.
- Shows a message for invalid ranges or ranges without invoices.
- Supports up to **10,000 invoices per file**.

There is no preset day-range restriction. If the record limit is exceeded, split the export into smaller date ranges.

The database records an `INVOICE_EXPORT_REQUESTED` event when a non-empty export dataset is prepared. This records dataset preparation, not confirmation that the browser saved the file.

## Delete an invoice

**Available to active administrators only. Deletion is permanent.**

1. Open the invoice's process page.
2. Select **Delete invoice** beside the edit-details action.
3. Review the invoice number and supplier.
4. Type the invoice number exactly as displayed.
5. Confirm **Delete invoice**.

After a successful deletion, the application returns to the dashboard.

The operation removes the invoice and its related processing-stage and ASN records in one database transaction.

Existing activity records remain, and an `INVOICE_DELETED` event stores the actor and a snapshot of the deleted data.

Deleted invoices appear as text in the activity table rather than links to a missing page. Invoice filtering uses the number recorded at the time of the event.

If another user has updated the invoice since the page was opened, deletion is rejected until the administrator reloads and reviews the latest record.

There is no invoice restore action in the application.

## Activity history

**Available to active administrators.**

The activity log supports searching and filtering by invoice, actor, action type and date range. Expand a record to inspect recorded changes and previous/new values where available.

Vehicle-related events include:

| Event | Meaning |
| --- | --- |
| `VEHICLE_CREATED` | A vehicle record was created. |
| `VEHICLE_RENAMED` | A vehicle number was edited. |
| `INVOICE_VEHICLE_UPDATED` | An invoice's vehicle assignment or displayed number changed. |
| `VEHICLE_ARCHIVED` | A vehicle was archived. |
| `VEHICLE_RESTORED` | An archived vehicle was restored. |
| `VEHICLE_DELETED` | An unassigned vehicle was permanently deleted. |

Deleting an invoice or vehicle does not itself clear its activity history.

Administrators can separately clear activity history through the confirmation flow. This is permanent and applies to all stored activity records, including records outside the current filters. The clear operation records who performed it and how many records were removed.

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

You need:

- Git.
- Node.js compatible with the project's Next.js version.
- npm.
- Access to the designated Supabase project.
- Approved environment values.
- An active account provisioned for the application.

Use a development database for development work.

### 2. Clone and install

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
| `SUPABASE_SECRET_KEY` | Server-only key used for administrative account provisioning. |

Never commit `.env.local` or real credentials.

Do not prefix the secret key with `NEXT_PUBLIC_` or use it in browser code. Restart the development server after changing environment values.

### 4. Prepare the database

The application requires its schema, policies, functions and Realtime configuration before it can operate.

For a new environment:

1. Obtain the complete migration history from the maintainer.
2. Apply migrations in filename order using the team's migration process.
3. Confirm that the public overview and summary RPCs, pending-reason support and activity-clear function are included.
4. Apply the relevant feature migrations before deploying their UI changes.
5. Configure Realtime for the application's subscriptions.
6. Have the maintainer provision the first active administrator.

Recent feature migrations include:

| Migration | Purpose |
| --- | --- |
| `202610110001_invoice_delete_and_date_export.sql` | Administrator invoice deletion and Document date export. |
| `202610120001_invoice_vehicle_number.sql` | Optional vehicle numbers and invoice create/edit support. |
| `202610120002_public_vehicle_search.sql` | Vehicle details and search in the public overview. |
| `202610120003_vehicle_management.sql` | Vehicle registry, invoice links, assignments and audit events. |
| `202610120004_vehicle_lifecycle.sql` | Archive, restore, guarded deletion and archived-assignment handling. |

These are incremental migrations, not the complete database installation.

For an existing environment with Vehicle Management already installed, apply `202610120004_vehicle_lifecycle.sql` for the lifecycle update. Do not rerun `202610120003_vehicle_management.sql` as part of that update.

Keep all migration files in the repository.

If SQL reports:

```text
42723: function "vehicle_key" already exists with same argument types
```

Check the migration history and existing definitions before proceeding. Existing objects alone do not prove that every migration statement completed. Do not drop functions or tables to bypass the error.

An authenticated account also requires a matching `profiles` record with the correct role and active status. Installing dependencies does not create the database or administrator account.

### 5. Start the application

From `web/`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), or the address printed by the development server.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Read-only invoice overview. |
| `/login` | Workspace sign-in. |
| `/dashboard` | Invoice summary, search, filters and records. |
| `/dashboard/invoices/new` | Create an invoice with an optional vehicle number. |
| `/dashboard/invoices/[id]` | Invoice processing page. |
| `/dashboard/invoices/[id]/details` | Edit invoice details and vehicle assignment. |
| `/dashboard/vehicles` | Vehicle registry, assignments and lifecycle actions. |
| `/dashboard/export` | Administrator-only POST endpoint for Excel downloads. |
| `/dashboard/users` | Administrator user management. |
| `/dashboard/activity` | Administrator activity log. |
| `/dashboard/settings` | Account identity and password settings. |

`[id]` represents an invoice's internal identifier. The export endpoint is not a navigable page.

## Project structure

```text
web/
  src/
    app/
      page.tsx                 Read-only overview
      login/                   Sign-in page and actions
      dashboard/               Protected workspace
        invoices/              Invoice screens and actions
        export/                Excel download endpoint
        export-button.tsx      Export date-selection dialog
        vehicles/              Vehicle pages, dialogs and server actions
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
README.md                      Project documentation
```

## Data and access

### Primary tables

| Table | Responsibility |
| --- | --- |
| `profiles` | User names, roles and active access state. |
| `invoices` | Invoice identity, supplier, operational fields, status and current vehicle link. |
| `vehicles` | Vehicle numbers, normalized matching keys, archive state and versions. |
| `pre_grn_stages` | System-specific processing progress. |
| `asn_updates` | ASN sharing and assignment information. |
| `activity_logs` | Actors, actions, changes, timestamps and invoice-number snapshots. |

### Vehicle relationships

`invoices.vehicle_id` links an assigned invoice to `vehicles`.

Database triggers keep `invoices.vehicle_number` synchronized as the display/search value used by invoice views.

The `vehicles.is_archived` flag controls whether a vehicle is available for new assignments. Archiving does not remove existing relationships.

The invoice-to-vehicle foreign key restricts deletion of linked vehicles. The delete function also checks assignments and requires the exact vehicle-number confirmation.

### Authorization and consistency

- Protected operations check authentication and active profile permissions.
- Administrative vehicle operations require the ADMIN role.
- Vehicle writes use authorized database functions.
- Direct client writes to the vehicle registry are not granted.
- Version checks reject conflicting invoice and vehicle updates.
- Batch assignment failures roll back the entire batch.
- Vehicle deletion does not cascade to invoices.
- Public overview functions expose a selected set of fields.

Invoice deletion retains history through `invoice_number_snapshot` and a nullable invoice reference.

The `prepare_invoice_export_range` function validates the date range and prepares the export dataset.

## Development checks

Run from `web/`:

```bash
npm run lint
npm run build
```

To run a completed production build locally:

```bash
npm run start
```

Before submitting changes, verify the affected workflows.

### Authentication and permissions

- Sign-in and active/inactive account behaviour.
- ADMIN-only routes and actions.
- Rejection of unauthorized requests at the server/database level.

### Invoices and overview

- Invoice creation and detail editing.
- Processing-stage and ASN updates.
- Search, status cards, reset and pagination.
- Pending-reason highlighting and readable dialogs.
- Vehicle labels on the dashboard, overview and process page.
- Read-only behaviour of the public overview.

### Vehicle management

- Add a new vehicle and reuse an existing normalized number.
- Create a vehicle through invoice creation or editing.
- Assign, reassign and unassign invoices.
- Review and confirm a batch assignment.
- Reject stale invoice versions without partial updates.
- Edit a vehicle number and verify linked labels.
- Reject duplicate vehicle numbers.
- Archive without changing existing invoice data or labels.
- Exclude archived vehicles from new-assignment suggestions.
- Reject attempts to assign a new invoice to an archived number.
- Edit other details of an invoice retaining an archived assignment.
- Restore an archived vehicle.
- Delete an unassigned test vehicle using exact-number confirmation.
- Reject deletion if invoices are assigned.
- Confirm USER accounts cannot edit, archive, restore or delete vehicles.
- Confirm activity records for vehicle changes.

### Export and deletion

- Inclusive Document date boundaries and same-day exports.
- Empty and invalid export ranges.
- Independence from dashboard search and status filters.
- Export record limit.
- Invoice delete confirmation and stale-version rejection.
- Retained activity history after deletion.

### Interface

- Light and dark themes.
- Narrow-screen layouts.
- Centered dialogs, keyboard navigation and scrolling.
- Filter navigation without unexpected sidebar resets.
- Active/Archived navigation and pagination.
- Live-update behaviour.

A successful build does not replace workflow and permission testing against the intended database.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Sign-in succeeds but workspace access is unavailable | Confirm the matching profile, role and `is_active` value. |
| Administrator cannot create a user | Check the server-only secret key and account-provisioning migrations. |
| Overview cannot load invoice data | Check overview RPC definitions, grants and Supabase configuration. |
| Search reloads the page or resets the sidebar | Confirm search forms use Next.js `Form` navigation and retain the shared layout. |
| Summary totals differ from visible rows | Summary totals are all-time; table filters and pagination narrow the results. |
| Activity dates differ from expectations | Activity filters use Sri Lanka dates; the To date includes the full selected day. |
| A vehicle number cannot be edited | Confirm active ADMIN access, a unique normalized number and the latest vehicle version. |
| An archived vehicle is missing from the main list | Open the Archived view. |
| An archived number cannot be assigned | Restore it as an administrator or choose an active vehicle. |
| An archived vehicle remains visible on old invoices | Expected behaviour: archiving preserves existing links and labels. |
| Delete vehicle is unavailable | The vehicle has assigned invoices or the account is not an active administrator. |
| Vehicle deletion is rejected after opening the dialog | Reload; assignments or the vehicle version may have changed. |
| Delete confirmation remains disabled | Type the vehicle number exactly as displayed. |
| A vehicle is missing after typing its number | New vehicles are created when the invoice is saved. |
| Vehicle assignment reports a conflict | Reload and review the latest selection; the rejected batch is not partially saved. |
| Vehicle search returns no invoices | Try the number as displayed on the invoice label. |
| Pending reason is missing from the overview | Confirm Pending status, a nonblank reason and the current overview RPC. |
| `vehicle_key` already exists during migration | Check migration history and definitions rather than rerunning the create migration. |
| Vehicle lifecycle controls fail after updating the UI | Confirm `202610120004_vehicle_lifecycle.sql` was applied first. |
| Invoice delete or Excel export fails | Confirm the corresponding migration and active ADMIN access. |
| Invoice deletion reports a conflict | Reload and review the latest invoice before confirming again. |
| Deleted records remain in activity history | Expected behaviour: deletion retains audit history. |
| Export finds no invoices | Check Document dates and the selected range. |
| Export includes invoices outside the dashboard filters | Export uses its own Document date range independently of table filters. |
| Export exceeds 10,000 invoices | Split the range into smaller date ranges. |
| Live updates are disconnected | Check connectivity and Supabase Realtime configuration. |
| Environment changes are not taking effect | Restart the application server after editing `.env.local`. |

## Contributing

1. Pull the latest team-approved base branch.
2. Work on an assigned developer branch or feature branch.
3. Keep changes focused and preserve authorization checks.
4. Include a versioned migration for database changes.
5. Apply and verify database changes before the corresponding UI update.
6. Run lint/build checks and test the affected workflows.
7. Update documentation when behaviour changes.
8. Open a pull request describing the problem, changes and validation performed.

Do not commit credentials, real customer exports or unnecessary personal information. Use synthetic data in examples and screenshots.

## Ownership and support

Developed for **EFL 3PL · CSS Division**.

For account access, contact the dashboard administrator.

When reporting a defect, include:

- The affected page.
- Steps to reproduce the issue.
- Expected and actual results.
- Relevant error text.
- A screenshot with sensitive information removed.

No open-source license is declared in this README. Confirm ownership and distribution permissions with the project owner before sharing the code externally.