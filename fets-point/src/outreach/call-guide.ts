export const GUIDE_NOTE =
  "FETS working guide · listen first, record accurately, and agree the next step. Discuss optional support openly; this is not a provider-sponsored survey. No student contact lists, recalled exam questions or confidential exam content.";
export const CALL_GUIDE = [
  {
    id: "opening",
    title: "Introduce yourself and ask permission",
    say: "Good morning/afternoon. I’m [name] from Forun Testing & Educational Services—FETS. We’re speaking with CMA training institutes about students’ examination-centre experience and exploring useful mock-exam support for institutes. Would this be a convenient time for three or four minutes?",
    prompt:
      "If it is not convenient, agree a callback time or close politely. Do not launch into the questions.",
  },
  {
    id: "institute",
    title: "Understand the institute",
    say: "May I know your name and role? Roughly how many CMA students do you support in a year or examination cycle, and when is your next batch preparing to sit the exam?",
    prompt:
      "Ask for aggregate numbers only. An estimate or “not known” is fine.",
  },
  {
    id: "experience",
    title: "Listen to the candidate experience",
    say: "After students book their examination, what do they ask your team most often? What are the two or three worries or difficulties you hear about most? Does test-centre availability influence where or when they finally take the exam?",
    prompt:
      "Let them answer first. If needed, prompt about travel, check-in, requirements, waiting, communication, comfort, facilities or exam-day anxiety.",
  },
  {
    id: "practice",
    title: "Understand preparation and the gap",
    say: "How do students currently practise computer-based mock exams—at your institute, at home or elsewhere? Does anyone find the first experience of an examination-centre environment difficult on the actual day? What preparation would help?",
    prompt:
      "Respect what the institute already provides. Ask what could improve it, rather than suggesting their training is inadequate.",
  },
  {
    id: "centre",
    title: "Explore a centre visit if it would help",
    say: "Would a test-centre-style mock at FETS be useful for a batch like that? If so, what batch size, approximate dates and centre—Calicut or Kochi—would be practical? We can understand the requirements first and discuss suitable practice content and arrangements separately.",
    prompt:
      "This is an enquiry, not a confirmed booking, fee quotation or guarantee of capacity. Record interest separately from confirmed candidates.",
  },
  {
    id: "platform",
    title: "Offer an institute-hosted alternative when needed",
    say: "If bringing the students to FETS is not practical, would you prefer to discuss a platform that your institute could use at its own premises? What would you need from that arrangement?",
    prompt:
      "Keep this as an alternative. Record platform demand separately from candidates expected to attend FETS.",
  },
  {
    id: "recap",
    title: "Recap and agree follow-up",
    say: "Thank you. The main points I heard were [briefly repeat two or three points]. Have I understood correctly? May we follow up about [specific action] on [date and time]? What is the best business contact or channel to use?",
    prompt:
      "Record the agreed next action, owner and IST date/time. If they decline further contact, mark Do not contact and close the loop.",
  },
  {
    id: "advisory",
    title: "Optional relationship-building close",
    say: "Would you also be interested in a small FETS institute advisory group where we occasionally ask for feedback on candidate-experience improvements? There is no obligation.",
    prompt:
      "Advisory-group interest is separate from permission for a commercial follow-up. Keep the first call brief; use deeper questions only when invited.",
  },
];
export const CALL_BRANCHES = [
  {
    id: "reception",
    title: "When speaking to reception",
    say: "Could you help me reach the person who coordinates CMA students’ examination readiness or examination-centre arrangements? I’m [name] from FETS, calling for a short discussion about candidate experience and possible mock-exam support.",
  },
  {
    id: "busy",
    title: "When they are busy",
    say: "Of course. Would another day or time suit you, or would you prefer that we leave it here? I’ll follow the preference you give.",
  },
  {
    id: "selling",
    title: "“Is this a sales call?”",
    say: "We do want to understand whether optional FETS mock-exam support could be useful, and we’re being open about that. First, we would like to hear the difficulties your students face. There is no obligation to take a service or share student contacts.",
  },
  {
    id: "students",
    title: "“Are you asking for our student database?”",
    say: "No. We are not asking for students’ names, phone numbers or your database. Approximate batch numbers and your institute’s requirements are enough for this discussion. Your institute keeps its student relationships.",
  },
  {
    id: "existing",
    title: "When they already run good mocks",
    say: "That’s helpful to know. What works particularly well, and is there anything about the physical test-centre experience that students still find unfamiliar? If there is no gap to address, we can simply record your feedback.",
  },
  {
    id: "official",
    title: "“Is this requested by CMA, IMA or Prometric?”",
    say: "This is a FETS initiative. We are not representing it as a survey sponsored or requested by CMA, IMA, Prometric or another examination organisation.",
  },
  {
    id: "price",
    title: "When asked for price or guaranteed availability",
    say: "Let me record the batch size, date, location and requirements accurately. The responsible FETS colleague can then confirm the arrangements and any quotation. I don’t want to promise a slot or price before it is checked.",
  },
  {
    id: "decline",
    title: "When they are not interested",
    say: "Understood, and thank you for your time. Would you prefer no further contact about this? We will record and respect that preference.",
  },
];
