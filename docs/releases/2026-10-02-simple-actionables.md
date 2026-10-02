# Simple institution Actionables — 2 October 2026

Actionables is now a primary navigation item beside Live, Calendar, Roster and My Desk. The compact mission header leads into five districts and their institutions. The former social feed and campaign dashboard are removed from this page.

Active staff can create, edit and delete institutions with full address and contact details; open an institution to work together; assign duties with an owner, expected outcome, due date and optional IST time, reporting person and reporting method; and record, edit or delete outcomes with follow-up dates. Result history retains the original author and reporting recipient. Deleting the latest result restores the previous duty status. Deleting a stage moves its duties to General follow-ups.

Seven editable starting guides cover identification, approach, assessment, responsibilities, approval, setup and handover. Identification includes district-specific search instructions; approach includes a contact script. Staff can add custom stages. These are internal FETS workflow suggestions, with links to current official Pearson VUE guidance, not a substitute for provider requirements or approval. Stage completion needs a recorded result and completed duties; final handover also needs the preceding stages and all institution duties completed. Reopening work invalidates completion.

The live fets.live Supabase migration `20261001220000_simple_institution_actionables.sql` was applied by the deployment operator. No user SQL action is needed. Existing institutions and duties remain; the retired feed history remains stored, but no new automatic feed posts are generated. No demo records were committed.

Validation: production TypeScript/Vite build; four IST/stage-guide unit tests; desktop and mobile browser flow with mocked backend (institution creation, assignments, reporting identity, result/duty edits, custom stages); real REST relationship projections; transactional SQL verification as two active staff and a nonstaff identity, rolled back after testing. Live public release hash and browser smoke are checked during deployment. Authenticated production UI was not exercised with a staff password.

Refresh fets.live and choose Actionables from the top menu. Start by choosing a district and adding an institution.
