export const indiaDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function tenure(joined?: string, now = new Date()) {
  if (!joined || !/^\d{4}-\d{2}-\d{2}$/.test(joined)) return null;
  const start = Date.parse(joined + "T00:00:00Z");
  if (
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== joined
  )
    return null;
  const days =
    Math.floor((Date.parse(indiaDay(now) + "T00:00:00Z") - start) / 86400000) +
    1;
  return days > 0 ? days : null;
}
export const rounds = [
  {
    title: "The missing detail",
    question: "“I’ll send it later.” What would make this update more useful?",
    options: [
      "Add a clear owner and time",
      "Use capital letters",
      "Send the same message again",
    ],
    answer: 0,
    why: "A named owner and a specific time make a follow-up easier.",
  },
  {
    title: "Read between the lines",
    question:
      "A teammate writes “I’m stuck on this.” What is the most useful first reply?",
    options: [
      "“Try harder.”",
      "“Which part is blocking you?”",
      "“Someone else will do it.”",
    ],
    answer: 1,
    why: "A specific question helps you understand the problem before suggesting a fix.",
  },
  {
    title: "Keep it clear",
    question: "Which update is easiest to act on?",
    options: [
      "“The thing is done.”",
      "“Everything should be okay.”",
      "“The file is saved in Team Space; please review the final paragraph.”",
    ],
    answer: 2,
    why: "A location and a clear next action reduce unnecessary back-and-forth.",
  },
  {
    title: "Fact or guess?",
    question: "Which sentence describes an observation?",
    options: [
      "“The screen showed an error at 10:15.”",
      "“The system always fails.”",
      "“They probably pressed the wrong button.”",
    ],
    answer: 0,
    why: "A time and an observed event are more useful than a guess about the cause.",
  },
  {
    title: "Close the loop",
    question:
      "Someone helps you resolve a problem. What finishes the conversation?",
    options: [
      "Leave the chat immediately",
      "Confirm what worked and thank them",
      "Repeat the original question",
    ],
    answer: 1,
    why: "A short confirmation lets the other person know the task is resolved.",
  },
  {
    title: "One useful question",
    question: "Before starting an unfamiliar task, what is worth clarifying?",
    options: [
      "The colour of the folder",
      "How quickly everyone else works",
      "The expected result and who can help",
    ],
    answer: 2,
    why: "Knowing the result and where to ask for help saves time.",
  },
  {
    title: "A calmer handover",
    question: "What is easiest for the next person to follow?",
    options: [
      "What is done, what remains, and the next owner",
      "A long list with no order",
      "Only “all good”",
    ],
    answer: 0,
    why: "A short structure makes remaining work easier to pick up.",
  },
];
export const roundFor = (day: string) =>
  rounds[
    ((Math.floor(Date.parse(day + "T00:00:00Z") / 86400000) % rounds.length) +
      rounds.length) %
      rounds.length
  ];
