import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddUserDialog } from "./AddUserDialog";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
describe("Add User form", () => {
  it("submits all details and starts with empty personal fields", async () => {
    const onAdd = vi.fn().mockResolvedValue({}),
      onClose = vi.fn();
    render(<AddUserDialog onAdd={onAdd} onClose={onClose} />);
    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Initial password")).toHaveAttribute(
      "type",
      "password",
    );
    for (const [label, value] of [
      ["Full name", "Sample Staff"],
      ["Email", "sample@example.test"],
      ["Initial password", "fixture-password"],
      ["Contact number", "1234"],
      ["Position", "Invigilator"],
      ["Joining date", "2026-10-24"],
      ["Employee ID (on payslip)", "FETS99"],
      ["Designation (on payslip)", "Administrator"],
      ["Remarks", "Sample remarks"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Add certificates" }));
    fireEvent.change(screen.getByLabelText("Certificates 1"), {
      target: { value: "Sample certificate" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add User", exact: true }),
    );
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      full_name: "Sample Staff",
      contact_number: "1234",
      position: "Invigilator",
      joining_date: "2026-10-24",
      permissions: { employee_id: "FETS99", designation: "Administrator" },
      certificates: [{ title: "Sample certificate" }],
      remarks: "Sample remarks",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it("keeps entered details and displays server errors on failure", async () => {
    const onAdd = vi.fn().mockRejectedValue(Error("Email already registered")),
      onClose = vi.fn();
    const { container } = render(
      <AddUserDialog onAdd={onAdd} onClose={onClose} />,
    );
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Keep this name" },
    });
    fireEvent.submit(container.querySelector("form")!);
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Full name")).toHaveValue("Keep this name");
    expect(onClose).not.toHaveBeenCalled();
  });
});
