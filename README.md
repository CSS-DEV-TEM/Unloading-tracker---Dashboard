# Unloading Tracker Dashboard

An invoice and unloading workflow dashboard developed for **EFL 3PL · CSS Division**.

The application gives operations teams a shared view of invoice progress, AX/D365 processing stages, ASN updates and vehicle assignments. Authorized users manage records through the internal workspace, while a searchable, read-only overview provides visibility without editing access.

Last updated: **21 October 2026**.

## Contents

- [Overview](#overview)
- [Features](#features)
- [User roles](#user-roles)
- [Daily workflow](#daily-workflow)
- [Import invoices from email](#import-invoices-from-email)
- [Quantities and units](#quantities-and-units)
- [Dates and completion](#dates-and-completion)
- [Deployment](#deployment)
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
- Document date, roll quantity and optional meter quantity.
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

### Latest updates

- Email table copy/paste import replaces the PDF extraction workflow.
- Import preview supports review, editing, removal, duplicate handling and selective save retries.
- PO-based AX/D365 detection, including FOC review indicators.
- Separate roll and meter storage, with up to three decimal places for meters.
- Combined quantity display with blue MTR badges on the dashboard and public overview.
- Quantity/unit selection when creating or editing invoices.
- Vehicle received-date entry and visible received-date labels.
- Excel export includes a separate numeric METERS QTY column.

### Invoice workspace

- Search invoices by invoice number, supplier or vehicle number.
- Filter records by status.
- Select summary cards to apply a status filter.
- Open the process page by selecting an invoice number.
- Create invoices manually or import them from copied email tables.
- Edit invoice details and quantity units before saving.
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

### Import invoices from email

Open `/dashboard/invoices/import` with an active USER or ADMIN account.

The current workflow parses copied email tables in the browser. **Do not convert the email to PDF first.** Python, FastAPI, pdfplumber, a PDF extraction service and temporary PDF Storage uploads are not required for this workflow.

### Import steps

1. Copy the complete email table, including column headings and all rows.
2. Paste it into **Paste email table**.
3. Select the format to use for ambiguous dates: Month/Day/Year or Day/Month/Year.
4. Select **Extract invoices**.
5. If the header only says **Qty** or **Quantity**, select **Rolls** or **MTR**, then extract again. The pasted text is retained while a unit is required.
6. Review invoice numbers, suppliers, quantities, system, document date, shipment type and review notes.
7. Correct missing/invalid values and resolve duplicate drafts.
8. Select **Save invoices**. Successfully saved drafts are retained and are not resubmitted when retrying failed drafts.

### Supported input and limits

- HTML tables copied from email, tab-separated tables, Markdown tables and flattened copies with one cell per line.
- Required headings: **Date, PO, Invoice No, Supplier**, plus a supported quantity heading.
- `Qty(MTR)` and supported meter headings identify meters automatically; explicit roll headings identify rolls.
- A generic `Qty` heading requires a unit choice, including when its values are whole numbers. Decimal values alone do not prove the unit is meters.
- Maximum pasted text: **1,000,000 characters**; maximum imported source rows: **5,000**.
- Comma thousands separators are supported, for example `3,419.20`.
- Values such as `###` are not guessed or converted to zero. They produce review notes and leave the affected total blank.
- Flattened copies must retain the complete column sequence. Missing cells can make a row incomplete or shifted; copy the complete table again.
- Recognized final totals are checked against the copied rows and are not imported as invoices. Mismatches stop extraction. A single total covering both rolls and meters requires manual review.

### Invoice grouping and duplicate handling

Rows with the same trimmed, case-insensitive invoice number are grouped within a paste. Quantities are summed separately by unit from the original source rows. An invalid source value prevents presenting a partial total as complete.

Supplier, date and shipment inconsistencies produce review notes. Repeated invoice numbers across separately extracted batches require explicit review: combine only distinct quantities, not repeated copies of the same data. Combining recalculates from original source rows and resets manual draft edits except the invoice number.

The database blocks duplicates by **invoice number**, not by supplier or date. Edit an existing invoice rather than creating another with the same number.

If a save response is lost, the batch stops and marks that invoice as unconfirmed. Check the dashboard before importing it again; a network failure does not prove that the database write failed.

### System selection uses PO

System detection uses the **PO column**, not Sales order.

| PO values for one invoice | Result |
| --- | --- |
| SL prefix only | D365 |
| KP prefix only | AX |
| Both SL and KP prefixes | AX/D365 |
| Combined SL/KP prefix | AX/D365 |
| SL plus FOC | D365; include FOC quantities |
| KP plus FOC | AX; include FOC quantities |
| SL and KP plus FOC | AX/D365; include FOC quantities |
| FOC rows only | Select the system manually |
| Unknown non-FOC prefix | Review and select the system manually |

FOC rows contribute to quantities. They are highlighted with an **FOC** badge and review notes in the import preview. This badge is preview metadata; do not assume it is stored as a permanent dashboard field.

When both AX and D365 apply, the result is AX/D365 regardless of which prefix occurs more often.

### Supplier mapping

| Normalized supplier | Default shipment |
| --- | --- |
| South Asia | Local |
| Ocean Lanka | Local |
| Teejay | Local |
| Hayleys | Local |
| Other supplier names | Import |

Matching ignores case and normalizes whitespace. These are name matches, not fuzzy company-name recognition. Review variants such as legal suffixes and correct Local/Import before saving when necessary.

## Quantities and units

Rolls and meters remain separate database values:

| Field | Accepted values |
| --- | --- |
| `roll_quantity` | Optional non-negative integer, maximum 2,147,483,647 |
| `meter_quantity` | Optional non-negative number, maximum 999,999,999.999; up to three decimal places |

New Invoice uses one quantity input with a **Rolls / MTR** selector. Edit Invoice loads the saved unit and value. Imported invoices containing both units retain separate editing fields so neither measurement is silently discarded.

Changing the selected unit does **not** convert the number. Rolls and meters cannot be added together or converted without additional business data.

The dashboard and public overview retain their **Roll Qty / Roll quantity** heading and show both measurements within that one column:

- Rolls: plain number, without a unit badge.
- Meters: number with a blue **MTR** badge.
- Both measurements: separate lines in the same cell.
- No quantity: an em dash. Zero remains a valid visible quantity.

The process summary also uses the quantity detail with an MTR badge. Excel keeps separate ROLL QTY and METERS QTY columns for filtering and calculations.

## Dates and completion

The importer accepts day/month or month/day dates separated by `/`, `.` or `-`, and ISO year-month-day dates. Examples include `15.10.2026`, `15/10/2026`, `10/15/2026` and `2026-10-15`.

An unambiguous date is recognized automatically. For example, `15.10.2026` is 15 October. An ambiguous date such as `05/06/2026` uses the selected format. Invalid calendar dates require review.

| Value | Meaning |
| --- | --- |
| `document_share_date` | Invoice document date; used by date-range export |
| `vehicles.received_date` | Shared received date of the assigned vehicle |
| Stage `started_at` / `ended_at` | AX or D365 processing timestamps |
| ASN `share_date` | Date entered for ASN sharing |
| Invoice `completed_at` | Timestamp when the invoice was marked Complete |

**ASN share date and invoice completion timestamp are different fields.** The overview's Completion date displays `completed_at` for Complete invoices. Stage end dates belong in processing details; they do not substitute for invoice completion.

Checking ASN Share and saving completes the invoice under the workflow rules. Unchecking it and saving returns the invoice to Pending, allowing vehicle changes where other linked-record restrictions permit them. Completed/ASN-shared records can lock vehicle assignment or received-date changes.

When editing table layouts, keep one body cell per heading: an extra Start date cell shifts Completion date, Status and Processing into the wrong columns without changing stored data.

## Vehicle management

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
| Import invoices from copied email tables | No | Yes | Yes |
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
2. **Create records:** enter invoice details manually or paste an email table into Invoice Import, extract and review the drafts, then save.
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

### Vehicle received date

Set the received date from the relevant vehicle or invoice form. It belongs to the vehicle and is shared by its linked invoices. Vehicle labels expose the received-date information on the dashboard and public overview.

- A received date entered on an invoice requires a vehicle number.
- Leaving the invoice form's received date blank preserves an existing vehicle date; it is not a command to erase it.
- Editing the date can affect all invoices linked to that vehicle.
- Version checks and completed/ASN-shared restrictions may require reloading or reopening affected invoices before changing the date.

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
- Includes separate **ROLL QTY** and **METERS QTY** numeric columns.
- Formats meters with up to three decimal places (`0.###`).
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
| Email extraction | Browser-side TypeScript table parser |
| Web hosting | Vercel |
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
3. Confirm that the public overview and summary RPCs, meters support, received-date support, pending-reason support and activity-clear function are included.
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

The current quantity-aware application expects `invoices.meter_quantity`, `save_invoice_with_meters`, `get_public_invoice_overview_v4` and `get_public_invoice_summary`. Apply the corresponding schema, grants and function definitions before deploying the updated application. These requirements supplement the earlier migrations above.

The Excel export RPC `prepare_invoice_export_range` includes invoice fields through `to_jsonb(i)` in the supplied migration; the meter column therefore flows into its invoice payload after the schema update.

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

## Deployment

The web application is deployed to **Vercel**, with authentication and data hosted by **Supabase**.

1. Apply the required migrations to the intended Supabase project.
2. Configure the three Supabase environment variables from Local development in the Vercel web project. Use values belonging to the same Supabase project.
3. Confirm the web application root is `web` and the intended Git branch is connected to the deployment environment.
4. Run the build and affected workflow checks, then deploy the reviewed changes.
5. After environment changes, redeploy so the application uses the new values.
6. Verify sign-in, overview, email import, quantity saving, vehicle dates and administrator export on the live URL.

The email-paste flow does not require `INVOICE_IMPORT_API_URL`, `INVOICE_IMPORT_API_KEY`, a Render Python service, or the old `invoice-imports` PDF bucket. Retired PDF routes/services and credentials should not remain active solely for this workflow. Confirm nothing else depends on a resource before removing it.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Read-only invoice overview. |
| `/login` | Workspace sign-in. |
| `/dashboard` | Invoice summary, search, filters and records. |
| `/dashboard/invoices/new` | Create an invoice with quantity/unit and optional vehicle/received date. |
| `/dashboard/invoices/import` | Paste email tables, extract, review and save invoice drafts. |
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
        invoices/
          import/
            email-table.ts     Email parser, date/unit handling and PO rules
            import-form.tsx    Draft review, grouping, FOC indicators and saving
          new/                 Manual creation and import save action
          [id]/                Processing, detail editing and deletion
        export/                Excel download endpoint
        export-button.tsx      Export date-selection dialog
        vehicles/              Vehicle pages, dialogs and server actions
        users/                 User administration
        activity/              Activity filters and expandable records
        settings/              Account settings
    components/                Shared interface components
    lib/
      supabase/                Supabase client configuration
      meter-quantity.ts        Decimal validation and precise meter summation
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

### Email import and quantities

- HTML, TSV, Markdown and complete flattened table copies.
- Dot, slash and hyphen dates; ambiguous dates under both selected formats.
- Explicit MTR/roll headings and generic Qty requiring a unit choice.
- Decimal thousands-separated values, zero, blank and `###` values.
- Same-invoice grouping and separate roll/meter totals.
- SL, KP, combined systems, FOC-only and mixed FOC/non-FOC rows.
- Unknown PO prefixes requiring manual review.
- Duplicate draft combination versus repeated-copy removal.
- Partial save failures and unconfirmed network responses.
- Quantity/unit selection in create and edit, including invoices with both units.
- Blue MTR badges without introducing a second quantity table column.
- Numeric meter values in the downloaded workbook.

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
| Import asks for a unit | A generic Qty header has no unit; select Rolls or MTR and extract again. |
| Decimal quantity is blank | Check that MTR was selected for meter values; fractional rolls are invalid. |
| Import rejects an incomplete/shifted row | Copy the complete table including the final column and empty cells; flattened copies cannot recover missing boundaries reliably. |
| System is not detected | Check PO, not Sales order; unknown non-FOC prefixes and FOC-only invoices require review. |
| Invoice quantities look doubled | Check for repeated copies before combining drafts; combine only distinct source quantities. |
| Save result is unconfirmed | Check the dashboard before retrying; the write may already have succeeded. |
| Completion date appears under Status | Remove an extra body cell and align headings with cells; do not change database dates to fix layout. |
| Meters are missing after deployment | Check meter schema/RPC migrations and every invoice query's selected fields. |
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