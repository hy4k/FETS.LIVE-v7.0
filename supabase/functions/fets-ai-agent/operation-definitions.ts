/** Named domain operations only. Human review decisions are deliberately absent. */
export type OperationDefinition = {
  name: string; label: string; module: string; path: string; permission: string;
  review: boolean; applyMode: 'database' | 'module'; scope: 'centre' | 'shared' | 'own';
  parameters: { type: string; properties: Record<string, any>; required: string[]; additionalProperties: false };
};
export const OPERATION_DEFINITIONS: OperationDefinition[] = [
  {
    "name": "create_incident",
    "label": "Create case",
    "module": "incident-log",
    "path": "/incident-log",
    "permission": "ws_case",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "description": {
          "type": "STRING",
          "description": ""
        },
        "severity": {
          "type": "STRING",
          "enum": [
            "minor",
            "major",
            "critical"
          ]
        },
        "category": {
          "type": "STRING",
          "enum": [
            "computer",
            "equipment",
            "property",
            "staff",
            "candidate",
            "client",
            "utility",
            "other",
            "roster",
            "calendar",
            "facility",
            "systems",
            "network",
            "exam",
            "assets",
            "vendor"
          ]
        },
        "status": {
          "type": "STRING",
          "enum": [
            "open",
            "assigned",
            "in_progress",
            "escalated",
            "closed"
          ]
        },
        "assigned_to": {
          "type": "STRING",
          "description": "Verified Auth user UUID"
        },
        "notes": {
          "type": "STRING",
          "description": ""
        },
        "due_date": {
          "type": "STRING",
          "description": "YYYY-MM-DD"
        }
      },
      "required": [
        "title",
        "description",
        "severity"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_incident",
    "label": "Update case",
    "module": "incident-log",
    "path": "/incident-log",
    "permission": "ws_case",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "description": {
          "type": "STRING",
          "description": ""
        },
        "severity": {
          "type": "STRING",
          "enum": [
            "minor",
            "major",
            "critical"
          ]
        },
        "category": {
          "type": "STRING",
          "enum": [
            "computer",
            "equipment",
            "property",
            "staff",
            "candidate",
            "client",
            "utility",
            "other",
            "roster",
            "calendar",
            "facility",
            "systems",
            "network",
            "exam",
            "assets",
            "vendor"
          ]
        },
        "status": {
          "type": "STRING",
          "enum": [
            "open",
            "assigned",
            "in_progress",
            "escalated",
            "closed"
          ]
        },
        "assigned_to": {
          "type": "STRING",
          "description": "Verified Auth user UUID"
        },
        "notes": {
          "type": "STRING",
          "description": ""
        },
        "due_date": {
          "type": "STRING",
          "description": "YYYY-MM-DD"
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_task",
    "label": "Create task",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "description": {
          "type": "STRING",
          "description": ""
        },
        "priority": {
          "type": "STRING",
          "enum": [
            "low",
            "medium",
            "high"
          ]
        },
        "status": {
          "type": "STRING",
          "enum": [
            "pending",
            "in_progress",
            "completed",
            "cancelled"
          ]
        },
        "assigned_to": {
          "type": "STRING",
          "description": "Verified Auth user UUID"
        },
        "due_date": {
          "type": "STRING",
          "description": "ISO timestamp"
        }
      },
      "required": [
        "title"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_task",
    "label": "Update task",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "description": {
          "type": "STRING",
          "description": ""
        },
        "priority": {
          "type": "STRING",
          "enum": [
            "low",
            "medium",
            "high"
          ]
        },
        "status": {
          "type": "STRING",
          "enum": [
            "pending",
            "in_progress",
            "completed",
            "cancelled"
          ]
        },
        "assigned_to": {
          "type": "STRING",
          "description": "Verified Auth user UUID"
        },
        "due_date": {
          "type": "STRING",
          "description": "ISO timestamp"
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_session",
    "label": "Create session",
    "module": "fets-calendar",
    "path": "/calendar",
    "permission": "calendar",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "client_name": {
          "type": "STRING",
          "description": ""
        },
        "exam_name": {
          "type": "STRING",
          "description": ""
        },
        "date": {
          "type": "STRING",
          "description": "YYYY-MM-DD"
        },
        "start_time": {
          "type": "STRING",
          "description": "HH:mm"
        },
        "end_time": {
          "type": "STRING",
          "description": "HH:mm"
        },
        "candidate_count": {
          "type": "INTEGER",
          "description": ""
        },
        "status": {
          "type": "STRING",
          "enum": [
            "scheduled",
            "in_progress",
            "completed",
            "cancelled"
          ]
        }
      },
      "required": [
        "client_name",
        "exam_name",
        "date",
        "start_time",
        "end_time"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_session",
    "label": "Update session",
    "module": "fets-calendar",
    "path": "/calendar",
    "permission": "calendar",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "client_name": {
          "type": "STRING",
          "description": ""
        },
        "exam_name": {
          "type": "STRING",
          "description": ""
        },
        "date": {
          "type": "STRING",
          "description": "YYYY-MM-DD"
        },
        "start_time": {
          "type": "STRING",
          "description": "HH:mm"
        },
        "end_time": {
          "type": "STRING",
          "description": "HH:mm"
        },
        "candidate_count": {
          "type": "INTEGER",
          "description": ""
        },
        "status": {
          "type": "STRING",
          "enum": [
            "scheduled",
            "in_progress",
            "completed",
            "cancelled"
          ]
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_session",
    "label": "Delete session",
    "module": "fets-calendar",
    "path": "/calendar",
    "permission": "calendar",
    "review": true,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_incident",
    "label": "Delete case",
    "module": "incident-log",
    "path": "/incident-log",
    "permission": "ws_case",
    "review": true,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_task",
    "label": "Delete task",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_case_comment",
    "label": "Add case comment",
    "module": "incident-log",
    "path": "/incident-log",
    "permission": "ws_case",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "incident_id": {
          "type": "STRING",
          "description": ""
        },
        "body": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "incident_id",
        "body"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_client",
    "label": "Create client",
    "module": "client-directory",
    "path": "/calendar",
    "permission": "catalogue",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "color": {
          "type": "STRING",
          "description": ""
        },
        "logo_url": {
          "type": "STRING",
          "description": "Public HTTPS URL"
        }
      },
      "required": [
        "name"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_client",
    "label": "Update client",
    "module": "client-directory",
    "path": "/calendar",
    "permission": "catalogue",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "color": {
          "type": "STRING",
          "description": ""
        },
        "logo_url": {
          "type": "STRING",
          "description": "Public HTTPS URL"
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_client",
    "label": "Delete client",
    "module": "client-directory",
    "path": "/calendar",
    "permission": "catalogue",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_programme",
    "label": "Create programme",
    "module": "client-directory",
    "path": "/calendar",
    "permission": "catalogue",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "client_id": {
          "type": "STRING",
          "description": ""
        },
        "name": {
          "type": "STRING",
          "description": ""
        },
        "locations": {
          "type": "ARRAY",
          "items": {
            "type": "STRING",
            "description": ""
          },
          "description": "Centre IDs"
        }
      },
      "required": [
        "client_id",
        "name"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_programme",
    "label": "Update programme",
    "module": "client-directory",
    "path": "/calendar",
    "permission": "catalogue",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "name": {
          "type": "STRING",
          "description": ""
        },
        "locations": {
          "type": "ARRAY",
          "items": {
            "type": "STRING",
            "description": ""
          },
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_programme",
    "label": "Delete programme",
    "module": "client-directory",
    "path": "/calendar",
    "permission": "catalogue",
    "review": true,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "import_candidate_roster",
    "label": "Prepare candidate roster import",
    "module": "candidate-tracker",
    "path": "/candidate-tracker",
    "permission": "ws_candidate-tracker",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "day": {
          "type": "STRING",
          "description": ""
        },
        "provider": {
          "type": "STRING",
          "enum": [
            "pearson",
            "prometric",
            "paragon",
            "other"
          ]
        },
        "source_name": {
          "type": "STRING",
          "description": ""
        },
        "row_count": {
          "type": "INTEGER",
          "description": ""
        }
      },
      "required": [
        "day",
        "provider",
        "source_name",
        "row_count"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "set_roster_shift",
    "label": "Set roster shift",
    "module": "fets-roster",
    "path": "/roster",
    "permission": "can_edit_roster",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "profile_id": {
          "type": "STRING",
          "description": "Verified staff profile UUID"
        },
        "date": {
          "type": "STRING",
          "description": ""
        },
        "shift_code": {
          "type": "STRING",
          "enum": [
            "D",
            "HD",
            "RD"
          ]
        },
        "shift_label": {
          "type": "STRING",
          "description": ""
        },
        "shift_start": {
          "type": "STRING",
          "description": ""
        },
        "shift_end": {
          "type": "STRING",
          "description": ""
        },
        "grace_minutes": {
          "type": "INTEGER",
          "description": ""
        },
        "expected_version": {
          "type": "INTEGER",
          "description": "0 for new shift; exact current version to replace"
        }
      },
      "required": [
        "profile_id",
        "date",
        "shift_code",
        "expected_version"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "remove_roster_shift",
    "label": "Remove roster shift",
    "module": "fets-roster",
    "path": "/roster",
    "permission": "can_edit_roster",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_roster_bulk_change",
    "label": "Prepare bulk roster change",
    "module": "fets-roster",
    "path": "/roster",
    "permission": "can_edit_roster",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "from": {
          "type": "STRING",
          "description": ""
        },
        "to": {
          "type": "STRING",
          "description": ""
        },
        "profile_ids": {
          "type": "ARRAY",
          "items": {
            "type": "STRING",
            "description": ""
          },
          "description": ""
        },
        "shift_code": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "from",
        "to",
        "profile_ids",
        "shift_code",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_shift_plan",
    "label": "Prepare Shift plan",
    "module": "handover",
    "path": "/handover",
    "permission": "shift",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "day": {
          "type": "STRING",
          "description": ""
        },
        "lead_id": {
          "type": "STRING",
          "description": "Verified profile UUID"
        },
        "instructions": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "day",
        "lead_id",
        "instructions"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_shift_report",
    "label": "Prepare Shift closing report",
    "module": "handover",
    "path": "/handover",
    "permission": "shift",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "day": {
          "type": "STRING",
          "description": ""
        },
        "summary": {
          "type": "STRING",
          "description": ""
        },
        "pending": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "day",
        "summary"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_daily_report",
    "label": "Prepare daily operations report",
    "module": "handover",
    "path": "/handover",
    "permission": "shift",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "day": {
          "type": "STRING",
          "description": ""
        },
        "kind": {
          "type": "STRING",
          "enum": [
            "opening",
            "closing"
          ]
        },
        "overall": {
          "type": "STRING",
          "enum": [
            "ready",
            "issues"
          ]
        },
        "issues": {
          "type": "STRING",
          "description": ""
        },
        "action_taken": {
          "type": "STRING",
          "description": ""
        },
        "pending": {
          "type": "STRING",
          "description": ""
        },
        "manager_attention": {
          "type": "BOOLEAN",
          "description": ""
        }
      },
      "required": [
        "day",
        "kind",
        "overall"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_handover_signature",
    "label": "Prepare handover for responsible staff",
    "module": "handover",
    "path": "/handover",
    "permission": "shift",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "summary": {
          "type": "STRING",
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "summary"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_shift_task",
    "label": "Prepare Shift duty",
    "module": "handover",
    "path": "/handover",
    "permission": "shift",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "day": {
          "type": "STRING",
          "description": ""
        },
        "title": {
          "type": "STRING",
          "description": ""
        },
        "assigned_to": {
          "type": "STRING",
          "description": ""
        },
        "instructions": {
          "type": "STRING",
          "description": ""
        },
        "expected_result": {
          "type": "STRING",
          "description": ""
        },
        "due_minute": {
          "type": "INTEGER",
          "description": ""
        },
        "priority": {
          "type": "STRING",
          "enum": [
            "normal",
            "important"
          ]
        }
      },
      "required": [
        "day",
        "title",
        "assigned_to",
        "instructions",
        "expected_result"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_shift_task_review",
    "label": "Prepare independent Shift duty review",
    "module": "handover",
    "path": "/handover",
    "permission": "shift",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "decision": {
          "type": "STRING",
          "enum": [
            "verified",
            "rework"
          ]
        },
        "review_note": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "decision",
        "review_note"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "self_check_in",
    "label": "Record my check-in",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "name": "self_check_out",
    "label": "Record my check-out",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "name": "correct_attendance",
    "label": "Correct attendance",
    "module": "attn-admin",
    "path": "/attn-admin",
    "permission": "ws_attn-admin",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "check_in": {
          "type": "STRING",
          "description": ""
        },
        "check_out": {
          "type": "STRING",
          "description": ""
        },
        "status": {
          "type": "STRING",
          "enum": [
            "present",
            "absent",
            "late",
            "half_day"
          ]
        },
        "notes": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "submit_application",
    "label": "Submit my application",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "kind": {
          "type": "STRING",
          "enum": [
            "leave",
            "toil",
            "swap",
            "emergency_duty",
            "reimbursement"
          ]
        },
        "request_date": {
          "type": "STRING",
          "description": ""
        },
        "leave_type": {
          "type": "STRING",
          "description": ""
        },
        "half_day_period": {
          "type": "STRING",
          "enum": [
            "first",
            "second"
          ]
        },
        "swap_with_id": {
          "type": "STRING",
          "description": ""
        },
        "swap_date": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "kind",
        "request_date",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "withdraw_application",
    "label": "Withdraw my application",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "respond_to_swap",
    "label": "Record my swap response",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "accept": {
          "type": "BOOLEAN",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "accept"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "resolve_application",
    "label": "Resolve staff application",
    "module": "user-management",
    "path": "/user-management",
    "permission": "user_management_edit",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "decision": {
          "type": "STRING",
          "enum": [
            "approved",
            "rejected"
          ]
        },
        "admin_reply": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "decision",
        "admin_reply"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "submit_ot_claim",
    "label": "Submit my overtime claim",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "date": {
          "type": "STRING",
          "description": ""
        },
        "start_time": {
          "type": "STRING",
          "description": ""
        },
        "end_time": {
          "type": "STRING",
          "description": ""
        },
        "notes": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "date",
        "start_time",
        "end_time"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_ot_claim",
    "label": "Edit my pending overtime claim",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "start_time": {
          "type": "STRING",
          "description": ""
        },
        "end_time": {
          "type": "STRING",
          "description": ""
        },
        "notes": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "resolve_ot_claim",
    "label": "Resolve overtime claim",
    "module": "staff-ot",
    "path": "/staff-ot",
    "permission": "ws_staff-ot",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "decision": {
          "type": "STRING",
          "enum": [
            "approved",
            "rejected"
          ]
        },
        "approved_hours": {
          "type": "NUMBER"
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "settle_toil",
    "label": "Settle TOIL record",
    "module": "staff-ot",
    "path": "/staff-ot",
    "permission": "ws_staff-ot",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "compensated_date": {
          "type": "STRING",
          "description": ""
        },
        "paid_amount": {
          "type": "NUMBER"
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_payroll",
    "label": "Update monthly payroll",
    "module": "staff-ot",
    "path": "/staff-ot",
    "permission": "ws_staff-ot",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "month": {
          "type": "STRING",
          "description": ""
        },
        "paid_days": {
          "type": "NUMBER"
        },
        "adjustment": {
          "type": "NUMBER"
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_institution",
    "label": "Create institution",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "district": {
          "type": "STRING",
          "enum": [
            "Kottayam",
            "Ernakulam",
            "Thrissur",
            "Calicut",
            "Kannur"
          ]
        },
        "address": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_name": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_phone": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_email": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_role": {
          "type": "STRING",
          "description": ""
        },
        "website": {
          "type": "STRING",
          "description": "Public HTTPS URL"
        },
        "notes": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "name",
        "district",
        "primary_contact_name"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_institution",
    "label": "Update institution",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "district": {
          "type": "STRING",
          "enum": [
            "Kottayam",
            "Ernakulam",
            "Thrissur",
            "Calicut",
            "Kannur"
          ]
        },
        "address": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_name": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_phone": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_email": {
          "type": "STRING",
          "description": ""
        },
        "primary_contact_role": {
          "type": "STRING",
          "description": ""
        },
        "website": {
          "type": "STRING",
          "description": "Public HTTPS URL"
        },
        "notes": {
          "type": "STRING",
          "description": ""
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_institution",
    "label": "Delete institution and dependent history",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_institution_stage",
    "label": "Create institution stage",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "institution_id": {
          "type": "STRING",
          "description": ""
        },
        "title": {
          "type": "STRING",
          "description": ""
        },
        "instructions": {
          "type": "STRING",
          "description": ""
        },
        "contact_script": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "institution_id",
        "title"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_institution_stage",
    "label": "Edit institution stage",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "title": {
          "type": "STRING",
          "description": ""
        },
        "instructions": {
          "type": "STRING",
          "description": ""
        },
        "contact_script": {
          "type": "STRING",
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "complete_institution_stage",
    "label": "Record stage completion",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "completion_note": {
          "type": "STRING",
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "completion_note"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_institution_stage",
    "label": "Delete institution stage",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_institution_duty",
    "label": "Delete institution duty",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_institution_result",
    "label": "Delete institution result",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_institution_duty",
    "label": "Create institution duty",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "institution_id": {
          "type": "STRING",
          "description": ""
        },
        "title": {
          "type": "STRING",
          "description": ""
        },
        "instructions": {
          "type": "STRING",
          "description": ""
        },
        "owner_id": {
          "type": "STRING",
          "description": "Verified profile UUID"
        },
        "institution_stage_id": {
          "type": "STRING",
          "description": ""
        },
        "due_at": {
          "type": "STRING",
          "description": "ISO timestamp including +05:30 or Z"
        },
        "report_to_id": {
          "type": "STRING",
          "description": "Verified Auth UUID"
        },
        "report_instructions": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "institution_id",
        "title",
        "instructions",
        "owner_id",
        "due_at",
        "report_to_id",
        "report_instructions"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_institution_duty",
    "label": "Update institution duty",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "institution_id": {
          "type": "STRING",
          "description": ""
        },
        "title": {
          "type": "STRING",
          "description": ""
        },
        "instructions": {
          "type": "STRING",
          "description": ""
        },
        "owner_id": {
          "type": "STRING",
          "description": "Verified profile UUID"
        },
        "institution_stage_id": {
          "type": "STRING",
          "description": ""
        },
        "due_at": {
          "type": "STRING",
          "description": "ISO timestamp including +05:30 or Z"
        },
        "report_to_id": {
          "type": "STRING",
          "description": "Verified Auth UUID"
        },
        "report_instructions": {
          "type": "STRING",
          "description": ""
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "record_institution_result",
    "label": "Record duty result",
    "module": "actionables",
    "path": "/actionables",
    "permission": "actionables",
    "review": false,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "work_item_id": {
          "type": "STRING",
          "description": ""
        },
        "content": {
          "type": "STRING",
          "description": ""
        },
        "status": {
          "type": "STRING",
          "enum": [
            "in_progress",
            "blocked",
            "done"
          ]
        },
        "follow_up_at": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "work_item_id",
        "content",
        "status"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_asset",
    "label": "Create asset",
    "module": "system-manager",
    "path": "/system-manager",
    "permission": "ws_system-manager",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "system_type": {
          "type": "STRING",
          "enum": [
            "admin",
            "server",
            "workstation",
            "peripheral",
            "rented"
          ]
        },
        "status": {
          "type": "STRING",
          "enum": [
            "operational",
            "maintenance",
            "fault"
          ]
        },
        "serial_number": {
          "type": "STRING",
          "description": ""
        },
        "category_name": {
          "type": "STRING",
          "description": ""
        },
        "it_item_type": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "name",
        "system_type"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_asset",
    "label": "Update asset",
    "module": "system-manager",
    "path": "/system-manager",
    "permission": "ws_system-manager",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "system_type": {
          "type": "STRING",
          "enum": [
            "admin",
            "server",
            "workstation",
            "peripheral",
            "rented"
          ]
        },
        "status": {
          "type": "STRING",
          "enum": [
            "operational",
            "maintenance",
            "fault"
          ]
        },
        "serial_number": {
          "type": "STRING",
          "description": ""
        },
        "category_name": {
          "type": "STRING",
          "description": ""
        },
        "it_item_type": {
          "type": "STRING",
          "description": ""
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_asset",
    "label": "Delete asset",
    "module": "system-manager",
    "path": "/system-manager",
    "permission": "ws_system-manager",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_asset_service_note",
    "label": "Record asset service note",
    "module": "system-manager",
    "path": "/system-manager",
    "permission": "ws_system-manager",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "system_id": {
          "type": "STRING",
          "description": ""
        },
        "description": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "system_id",
        "description"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_lost_found_item",
    "label": "Create lost or found item",
    "module": "command-center",
    "path": "/",
    "permission": "lost_found",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "description": {
          "type": "STRING",
          "description": ""
        },
        "found_location": {
          "type": "STRING",
          "description": ""
        },
        "category": {
          "type": "STRING",
          "enum": [
            "electronics",
            "documents",
            "clothing",
            "accessories",
            "other"
          ]
        },
        "item_type": {
          "type": "STRING",
          "enum": [
            "lost",
            "found"
          ]
        },
        "locker": {
          "type": "STRING",
          "description": ""
        },
        "perishable": {
          "type": "BOOLEAN",
          "description": ""
        }
      },
      "required": [
        "description",
        "found_location"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_lost_found_item",
    "label": "Update lost or found item",
    "module": "command-center",
    "path": "/",
    "permission": "lost_found",
    "review": false,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "description": {
          "type": "STRING",
          "description": ""
        },
        "found_location": {
          "type": "STRING",
          "description": ""
        },
        "category": {
          "type": "STRING",
          "enum": [
            "electronics",
            "documents",
            "clothing",
            "accessories",
            "other"
          ]
        },
        "item_type": {
          "type": "STRING",
          "enum": [
            "lost",
            "found"
          ]
        },
        "locker": {
          "type": "STRING",
          "description": ""
        },
        "perishable": {
          "type": "BOOLEAN",
          "description": ""
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "release_lost_found_item",
    "label": "Prepare property release",
    "module": "command-center",
    "path": "/",
    "permission": "lost_found",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "claimant_name": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "claimant_name",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_lost_found_item",
    "label": "Delete lost or found item",
    "module": "command-center",
    "path": "/",
    "permission": "lost_found",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "publish_news",
    "label": "Publish announcement",
    "module": "news-manager",
    "path": "/news-manager",
    "permission": "ws_news-manager",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "content": {
          "type": "STRING",
          "description": ""
        },
        "priority": {
          "type": "STRING",
          "enum": [
            "normal",
            "high",
            "urgent"
          ]
        },
        "expires_at": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "content",
        "priority"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "remove_news",
    "label": "Remove announcement",
    "module": "news-manager",
    "path": "/news-manager",
    "permission": "ws_news-manager",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "publish_business_update",
    "label": "Prepare business profile update",
    "module": "business",
    "path": "/business",
    "permission": "ws_business",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "destination": {
          "type": "STRING",
          "description": "Exact known business location"
        },
        "content": {
          "type": "STRING",
          "description": ""
        },
        "source_url": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "destination",
        "content"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "reply_business_review",
    "label": "Prepare business review reply",
    "module": "business",
    "path": "/business",
    "permission": "ws_business",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "review_id": {
          "type": "STRING",
          "description": ""
        },
        "destination": {
          "type": "STRING",
          "description": ""
        },
        "reply": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "review_id",
        "destination",
        "reply"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "send_team_message",
    "label": "Send team message",
    "module": "fets-chat",
    "path": "/fets-chat",
    "permission": "ws_fets-chat",
    "review": true,
    "applyMode": "database",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "conversation_id": {
          "type": "STRING",
          "description": ""
        },
        "content": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "conversation_id",
        "content"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_team_group",
    "label": "Create team group",
    "module": "fets-chat",
    "path": "/fets-chat",
    "permission": "ws_fets-chat",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "name": {
          "type": "STRING",
          "description": ""
        },
        "member_ids": {
          "type": "ARRAY",
          "items": {
            "type": "STRING",
            "description": ""
          },
          "description": "Verified Auth UUIDs"
        }
      },
      "required": [
        "name",
        "member_ids"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_team_members",
    "label": "Invite team members",
    "module": "fets-chat",
    "path": "/fets-chat",
    "permission": "ws_fets-chat",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "conversation_id": {
          "type": "STRING",
          "description": ""
        },
        "member_ids": {
          "type": "ARRAY",
          "items": {
            "type": "STRING",
            "description": ""
          },
          "description": ""
        }
      },
      "required": [
        "conversation_id",
        "member_ids"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "remove_team_member",
    "label": "Remove team member",
    "module": "fets-chat",
    "path": "/fets-chat",
    "permission": "ws_fets-chat",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "conversation_id": {
          "type": "STRING",
          "description": ""
        },
        "member_id": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "conversation_id",
        "member_id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "create_desk_note",
    "label": "Create personal note",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "content": {
          "type": "STRING",
          "description": ""
        },
        "category": {
          "type": "STRING",
          "enum": [
            "note",
            "idea",
            "task",
            "reflection",
            "dream",
            "memo",
            "journal",
            "quote"
          ]
        },
        "is_starred": {
          "type": "BOOLEAN",
          "description": ""
        },
        "is_pinned": {
          "type": "BOOLEAN",
          "description": ""
        }
      },
      "required": [
        "title",
        "content"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_desk_note",
    "label": "Update personal note",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "content": {
          "type": "STRING",
          "description": ""
        },
        "category": {
          "type": "STRING",
          "enum": [
            "note",
            "idea",
            "task",
            "reflection",
            "dream",
            "memo",
            "journal",
            "quote"
          ]
        },
        "is_starred": {
          "type": "BOOLEAN",
          "description": ""
        },
        "is_pinned": {
          "type": "BOOLEAN",
          "description": ""
        },
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact updated_at from the current record"
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_desk_note",
    "label": "Delete personal note",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": "Exact saved record ID"
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": "Exact current record version or timestamp"
        },
        "reason": {
          "type": "STRING",
          "description": "Reason for irreversible removal"
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "save_desk_journal",
    "label": "Save my journal",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "date": {
          "type": "STRING",
          "description": ""
        },
        "note": {
          "type": "STRING",
          "description": ""
        },
        "mood": {
          "type": "STRING",
          "enum": [
            "",
            "bright",
            "steady",
            "focused",
            "slow"
          ]
        },
        "expected_version": {
          "type": "INTEGER",
          "description": ""
        }
      },
      "required": [
        "date",
        "note",
        "expected_version"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "save_desk_preferences",
    "label": "Save my desk preferences",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "cover": {
          "type": "STRING",
          "enum": [
            "peach",
            "sage",
            "lilac"
          ]
        },
        "expected_version": {
          "type": "INTEGER",
          "description": ""
        }
      },
      "required": [
        "cover",
        "expected_version"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_document",
    "label": "Prepare document in existing workspace",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "purpose": {
          "type": "STRING",
          "description": ""
        },
        "content": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "title",
        "purpose",
        "content"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "share_document",
    "label": "Prepare document sharing",
    "module": "my-desk",
    "path": "/my-desk",
    "permission": "desk",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "document_id": {
          "type": "STRING",
          "description": ""
        },
        "destination": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "document_id",
        "destination",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_staff_profile",
    "label": "Edit staff profile",
    "module": "profile",
    "path": "/profile",
    "permission": "profile",
    "review": false,
    "applyMode": "database",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "full_name": {
          "type": "STRING",
          "description": ""
        },
        "department": {
          "type": "STRING",
          "description": ""
        },
        "position": {
          "type": "STRING",
          "description": ""
        },
        "bio": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_staff_invitation",
    "label": "Prepare staff invitation",
    "module": "user-management",
    "path": "/user-management",
    "permission": "user_management_edit",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "full_name": {
          "type": "STRING",
          "description": ""
        },
        "email": {
          "type": "STRING",
          "description": ""
        },
        "branch": {
          "type": "STRING",
          "enum": [
            "cochin",
            "calicut",
            "kannur"
          ]
        },
        "role": {
          "type": "STRING",
          "enum": [
            "fetsian",
            "staff",
            "admin"
          ]
        }
      },
      "required": [
        "full_name",
        "email",
        "branch",
        "role"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "change_staff_access",
    "label": "Prepare staff access change",
    "module": "user-management",
    "path": "/user-management",
    "permission": "user_management_edit",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "role": {
          "type": "STRING",
          "enum": [
            "fetsian",
            "staff",
            "admin",
            "super_admin"
          ]
        },
        "is_active": {
          "type": "BOOLEAN",
          "description": ""
        },
        "permission_key": {
          "type": "STRING",
          "description": "One known User Management boolean key"
        },
        "permission_value": {
          "type": "BOOLEAN",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "archive_staff",
    "label": "Prepare staff archival",
    "module": "user-management",
    "path": "/user-management",
    "permission": "user_management_edit",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "employment_end_date": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "employment_end_date",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "grant_branch_delegation",
    "label": "Prepare branch delegation",
    "module": "branch-delegation",
    "path": "/branch-delegation",
    "permission": "ws_branch-delegation",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "profile_id": {
          "type": "STRING",
          "description": ""
        },
        "allowed_branch": {
          "type": "STRING",
          "enum": [
            "cochin",
            "calicut",
            "both"
          ]
        },
        "start_date": {
          "type": "STRING",
          "description": ""
        },
        "end_date": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "profile_id",
        "allowed_branch",
        "start_date",
        "end_date",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "revoke_branch_delegation",
    "label": "Prepare delegation removal",
    "module": "branch-delegation",
    "path": "/branch-delegation",
    "permission": "ws_branch-delegation",
    "review": true,
    "applyMode": "module",
    "scope": "centre",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        },
        "expected_snapshot": {
          "type": "STRING",
          "description": "Exact expected_snapshot returned by read_operation_target for this operation and target"
        }
      },
      "required": [
        "id",
        "expected_snapshot",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "publish_knowledge",
    "label": "Publish verified guide",
    "module": "fets-intelligence",
    "path": "/fets-intelligence",
    "permission": "knowledge",
    "review": true,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "content": {
          "type": "STRING",
          "description": ""
        },
        "source_url": {
          "type": "STRING",
          "description": "Verified public source URL"
        },
        "category": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "title",
        "content",
        "source_url"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "archive_knowledge",
    "label": "Archive guide",
    "module": "fets-intelligence",
    "path": "/fets-intelligence",
    "permission": "knowledge",
    "review": true,
    "applyMode": "database",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "id": {
          "type": "STRING",
          "description": ""
        },
        "expected_updated_at": {
          "type": "STRING",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "id",
        "expected_updated_at",
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "change_ai_settings",
    "label": "Prepare supported AI settings",
    "module": "fets-intelligence",
    "path": "/fets-intelligence",
    "permission": "settings",
    "review": true,
    "applyMode": "module",
    "scope": "shared",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "provider": {
          "type": "STRING",
          "enum": [
            "gemini",
            "claude"
          ]
        },
        "gemini_model": {
          "type": "STRING",
          "description": ""
        },
        "claude_model": {
          "type": "STRING",
          "description": ""
        },
        "max_tool_iterations": {
          "type": "INTEGER",
          "description": ""
        },
        "reason": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "reason"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "prepare_access_item",
    "label": "Prepare Access Hub metadata",
    "module": "access-hub",
    "path": "/access-hub",
    "permission": "ws_access-hub",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "category": {
          "type": "STRING",
          "description": ""
        },
        "url": {
          "type": "STRING",
          "description": "Public portal URL; never credentials"
        },
        "description": {
          "type": "STRING",
          "description": ""
        }
      },
      "required": [
        "title",
        "category",
        "url"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "open_access_portal",
    "label": "Open Access Hub workflow",
    "module": "access-hub",
    "path": "/access-hub",
    "permission": "ws_access-hub",
    "review": true,
    "applyMode": "module",
    "scope": "own",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "title": {
          "type": "STRING",
          "description": ""
        },
        "url": {
          "type": "STRING",
          "description": "Public portal URL; account secrets are entered only in the existing module"
        }
      },
      "required": [
        "title",
        "url"
      ],
      "additionalProperties": false
    }
  }
];
