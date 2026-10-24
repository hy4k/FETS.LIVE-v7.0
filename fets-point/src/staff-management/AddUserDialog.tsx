import React, { useEffect, useRef, useState } from "react";
import { StaffGrowthFields } from "./StaffGrowthFields";
import "./staff-form.css";
const fresh = () => ({
  full_name: "",
  email: "",
  password: "",
  contact_number: "",
  department: "Operations",
  role: "fetsian",
  branch_assigned: "calicut",
  joining_date: "",
  position: "",
  employee_id: "",
  designation: "",
  remarks: "",
  certificates: [],
  trainings_attended: [],
  future_trainings: [],
});
export function AddUserDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (value: any) => Promise<unknown>;
}) {
  const [value, setValue] = useState<any>(fresh),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  const field = (
    name: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label key={name}>
      {label}
      {required ? " *" : ""}
      <input
        aria-label={label}
        type={type}
        value={value[name]}
        onChange={(e) => setValue({ ...value, [name]: e.target.value })}
        required={required}
        autoComplete={
          name === "password"
            ? "new-password"
            : name === "email"
              ? "off"
              : undefined
        }
        minLength={name === "password" ? 8 : undefined}
        maxLength={name === "password" ? 128 : 250}
      />
    </label>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { employee_id, designation, ...profile } = value;
      await onAdd({
        ...profile,
        full_name: value.full_name.trim(),
        email: value.email.trim().toLowerCase(),
        permissions: {
          employee_id: employee_id.trim(),
          designation: designation.trim(),
          is_roster_active: true,
        },
      });
      setValue(fresh());
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not add this user. Your details are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="su-dialog"
      aria-label="Add User"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <header>
        <h2>Add User</h2>
        <button
          type="button"
          aria-label="Close Add User"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Account & contact</legend>
          <div className="su-fields">
            {field("full_name", "Full name", "text", true)}
            {field("email", "Email", "email", true)}
            {field("password", "Initial password", "password", true)}
            {field("contact_number", "Contact number", "tel")}
          </div>
          <p>
            Use at least 8 characters for the initial password. Enter it here
            only.
          </p>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Employment</legend>
          <div className="su-fields">
            <label>
              Role
              <select
                aria-label="Role"
                value={value.role}
                onChange={(e) => setValue({ ...value, role: e.target.value })}
              >
                <option value="fetsian">Fetsian</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
            <label>
              Branch
              <select
                aria-label="Branch"
                value={value.branch_assigned}
                onChange={(e) =>
                  setValue({ ...value, branch_assigned: e.target.value })
                }
              >
                {["calicut", "cochin", "kannur", "global"].map((b) => (
                  <option key={b} value={b}>
                    {b[0].toUpperCase() + b.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            {field("department", "Department", "text", true)}
            {field("position", "Position")}
            {field("joining_date", "Joining date", "date")}
            {field("employee_id", "Employee ID (on payslip)")}
            {field("designation", "Designation (on payslip)")}
          </div>
        </fieldset>
        <StaffGrowthFields value={value} onChange={setValue} disabled={busy} />
        {error && (
          <p className="su-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="su-primary" type="submit" disabled={busy}>
            {busy ? "Adding user…" : "Add User"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
