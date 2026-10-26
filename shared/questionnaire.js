// The Golf & Social Interest Questionnaire (/questions). One list drives the form on
// the page and the checks and the emailed summary on the server, so they can't drift.
//
// Question types: text, email, textarea, state (type-ahead list of states),
// radio (pick one), checkbox (pick any). `other: true` adds an "Other (please specify)"
// choice with a text box. `showIf` shows a question only when another one has that answer.

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "Outside the United States"
];

export const QUESTIONNAIRE = {
  title: "Golf & Social Interest Questionnaire",
  intro:
    "Whether you are a paid member or interested in joining us for golf, networking, travel, and social experiences, we would love to learn more about you. Your responses will help us plan meaningful connections and memorable experiences on and beyond the fairway.",
  closing: { heading: "Thank you for connecting with us", text: "Come for the golf. Stay for the friendships. Leave inspired." },
  sections: [
    {
      title: "About You",
      questions: [
        { id: "firstName", label: "First name", type: "text", required: true, max: 80 },
        { id: "lastName", label: "Last name", type: "text", required: true, max: 80 },
        { id: "email", label: "Email address", type: "email", required: true, max: 200 },
        { id: "state", label: "Where are you located?", type: "state", required: true, hint: "Start typing to find your state." },
        { id: "city", label: "City or town", type: "text", max: 120, sub: true, showIf: { id: "state", filled: true } },
        {
          id: "relationship", label: "Which best describes your relationship with Ladies on the Green®?", type: "radio", required: true,
          options: ["I am a paid member", "I am interested in becoming a member", "I am interested in attending golf and social events"]
        }
      ]
    },
    {
      title: "Your Golf Journey",
      questions: [
        {
          id: "yearsPlayed", label: "How many years have you played golf?", type: "radio", required: true, other: true,
          options: ["Less than 1 year", "1–3 years", "4–7 years", "8 or more years"]
        },
        { id: "attraction", label: "What attracts you most to the game of golf?", type: "textarea", max: 2000 },
        {
          id: "improve", label: "Which areas of your golf game would you like to improve?", type: "checkbox", required: true, other: true,
          hint: "Select all that apply.",
          options: ["Rules of golf", "Golf course etiquette", "Course navigation and strategy", "Putting", "Chipping and short game", "Iron play", "Driver and tee shots"]
        },
        {
          id: "barriers", label: "What currently prevents you from playing golf more often?", type: "checkbox", required: true, other: true,
          hint: "Select all that apply.",
          options: [
            "I am still learning how to play", "I do not know many people who play", "I do not get invited to play",
            "I am unfamiliar with golf etiquette", "Cost of playing", "Limited time", "Finding playing partners at my skill level", "Weather"
          ]
        }
      ]
    },
    {
      title: "Playing Preferences",
      questions: [
        {
          id: "playFrequency", label: "How often would you like to play golf?", type: "radio", required: true, other: true,
          options: ["Weekly", "Twice a month", "Monthly", "Quarterly", "When my schedule allows"]
        },
        {
          id: "playDays", label: "What days do you prefer to play golf?", type: "checkbox", required: true, other: true,
          hint: "Select all that apply.", options: ["Weekdays", "Weekends", "Flexible"]
        },
        {
          id: "budget", label: "What is your approximate monthly budget for golf?", type: "radio", other: true,
          options: ["Under $100", "$100–$199", "$200–$299", "$300–$499", "$500 or more"]
        }
      ]
    },
    {
      title: "Events & Experiences",
      questions: [
        {
          id: "eventFrequency", label: "How often would you attend Ladies on the Green® events?", type: "radio", required: true, other: true,
          options: ["Monthly", "Quarterly", "Seasonally", "When available"]
        },
        {
          id: "experiences", label: "Which experiences interest you most?", type: "checkbox", required: true, other: true,
          hint: "Select all that apply.",
          options: [
            "Golf clinics and lessons", "Group golf outings", "Networking and social gatherings", "Golf travel and weekend getaways",
            "Wellness and spa experiences", "Wine tastings and fine dining", "Charity tournaments", "Business and professional networking"
          ]
        },
        {
          id: "destinations", label: "Would you be interested in destination golf experiences?", type: "radio",
          options: ["Yes", "Maybe, depending on the destination", "Not at this time"]
        },
        { id: "destinationIdeas", label: "What destinations or experiences would you love us to organize?", type: "textarea", max: 2000 },
        {
          id: "updates", label: "Would you like to receive updates about upcoming golf events, social experiences, and membership opportunities?",
          type: "radio", options: ["Yes, please keep me informed", "No, thank you"]
        }
      ]
    },
    {
      title: "Member Referral",
      questions: [
        { id: "referred", label: "Were you referred to Ladies on the Green® by an existing member?", type: "radio", options: ["Yes", "No"] },
        {
          id: "referrer", label: "Please list the name of the member who referred you", type: "text", max: 160,
          showIf: { id: "referred", equals: "Yes" }
        }
      ]
    }
  ]
};

export const OTHER = "Other";
export const otherKey = (id) => `${id}Other`;

export const allQuestions = () => QUESTIONNAIRE.sections.flatMap((section) => section.questions);

export const isVisible = (question, answers) => {
  const rule = question.showIf;
  if (!rule) return true;
  return rule.filled ? Boolean(answers[rule.id]) : answers[rule.id] === rule.equals;
};
