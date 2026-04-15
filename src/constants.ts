import { QuestionNode } from './types';

export const QUESTION_FLOWS: Record<string, QuestionNode[]> = {
  initial: [
    {
      id: 'service_selection',
      field: 'service_type',
      question: {
        en: "Welcome to Structura AI. I'm your construction assistant. Which service can I help you with today?",
        de: "Willkommen bei Structura AI. Ich bin Ihr Bauassistent. Bei welcher Dienstleistung kann ich Ihnen heute helfen?"
      },
      type: 'choice',
      options: [
        { label: { en: 'Facade', de: 'Fassade' }, value: 'facade' },
        { label: { en: 'Supporting Wall', de: 'Stützmauer' }, value: 'supporting_wall' }
      ],
      next: (val) => {
        if (val === 'facade') return 'facade_type';
        if (val === 'supporting_wall') return 'wall_type';
        return null;
      }
    }
  ],
  facade: [
    {
      id: 'facade_type',
      field: 'material',
      question: {
        en: "Great choice 👍 Facade work improves insulation and aesthetics. Which type of facade system would you like?",
        de: "Gute Wahl 👍 Fassadenarbeiten verbessern die Isolierung und Ästhetik. Welches Fassadensystem wünschen Sie?"
      },
      type: 'choice',
      options: [
        { label: { en: 'EPS (Stiropor)', de: 'EPS (Styropor)' }, value: 'eps' },
        { label: { en: 'Mineral Wool', de: 'Steinwolle' }, value: 'mineral_wool' },
        { 
          label: { en: 'Not sure → recommend', de: 'Nicht sicher → Empfehlung' }, 
          value: 'not_sure',
          recommendation: {
            en: "We recommend Mineral Wool for better fire protection and breathability, or EPS for cost-efficiency.",
            de: "Wir empfehlen Steinwolle für besseren Brandschutz und Atmungsaktivität, oder EPS für Kosteneffizienz."
          }
        }
      ],
      next: 'facade_thickness'
    },
    {
      id: 'facade_thickness',
      field: 'thickness',
      question: {
        en: "What thickness would you like?",
        de: "Welche Dämmstärke wünschen Sie?"
      },
      type: 'choice',
      options: [
        { label: { en: '5 cm', de: '5 cm' }, value: '5cm' },
        { label: { en: '8 cm', de: '8 cm' }, value: '8cm' },
        { label: { en: '10 cm', de: '10 cm' }, value: '10cm' },
        { label: { en: '12 cm', de: '12 cm' }, value: '12cm' },
        { label: { en: 'Not sure', de: 'Nicht sicher' }, value: 'not_sure' }
      ],
      next: 'facade_area'
    },
    {
      id: 'facade_area',
      field: 'area',
      question: {
        en: "What surface area (m²) are we working with?",
        de: "Mit welcher Fläche (m²) arbeiten wir?"
      },
      type: 'number',
      placeholder: { en: 'e.g. 150', de: 'z.B. 150' },
      unit: 'm²',
      next: 'facade_color'
    },
    {
      id: 'facade_color',
      field: 'color',
      question: {
        en: "What color would you like for the finish?",
        de: "Welche Farbe wünschen Sie für den Abschluss?"
      },
      type: 'input',
      placeholder: { en: 'e.g. White, Light Gray...', de: 'z.B. Weiß, Hellgrau...' },
      next: 'facade_scaffolding'
    },
    {
      id: 'facade_scaffolding',
      field: 'scaffolding',
      question: {
        en: "Is scaffolding needed?",
        de: "Wird ein Gerüst benötigt?"
      },
      type: 'choice',
      options: [
        { label: { en: 'Yes', de: 'Ja' }, value: 'yes' },
        { label: { en: 'No', de: 'Nein' }, value: 'no' }
      ],
      next: 'facade_location'
    },
    {
      id: 'facade_location',
      field: 'location',
      question: {
        en: "Where is the project located?",
        de: "Wo befindet sich das Projekt?"
      },
      type: 'input',
      placeholder: { en: 'City / Region', de: 'Stadt / Region' },
      next: 'summary'
    }
  ],
  supporting_wall: [
    {
      id: 'wall_type',
      field: 'material',
      question: {
        en: "Great. Let's define your supporting wall. Which material should we use?",
        de: "Großartig. Lassen Sie uns Ihre Stützmauer definieren. Welches Material sollen wir verwenden?"
      },
      type: 'choice',
      options: [
        { label: { en: 'Concrete', de: 'Beton' }, value: 'concrete' },
        { label: { en: 'Stone', de: 'Stein' }, value: 'stone' },
        { label: { en: 'Gabion', de: 'Gabionen' }, value: 'gabion' },
        { label: { en: 'Not sure', de: 'Nicht sicher' }, value: 'not_sure' }
      ],
      next: 'wall_height'
    },
    {
      id: 'wall_height',
      field: 'height',
      question: {
        en: "What is the desired height of the wall?",
        de: "Wie hoch soll die Mauer sein?"
      },
      type: 'number',
      unit: 'm',
      next: 'wall_length'
    },
    {
      id: 'wall_length',
      field: 'length',
      question: {
        en: "What is the total length of the wall?",
        de: "Wie lang ist die Mauer insgesamt?"
      },
      type: 'number',
      unit: 'm',
      next: 'wall_drainage'
    },
    {
      id: 'wall_drainage',
      field: 'drainage',
      question: {
        en: "Is drainage needed?",
        de: "Wird eine Entwässerung benötigt?"
      },
      type: 'choice',
      options: [
        { label: { en: 'Yes', de: 'Ja' }, value: 'yes' },
        { label: { en: 'No', de: 'Nein' }, value: 'no' }
      ],
      next: 'wall_location'
    },
    {
      id: 'wall_location',
      field: 'location',
      question: {
        en: "Where is the project located?",
        de: "Wo befindet sich das Projekt?"
      },
      type: 'input',
      placeholder: { en: 'City / Region', de: 'Stadt / Region' },
      next: 'summary'
    }
  ]
};

export const PRICING_LOGIC = {
  facade: {
    base: 35, // base price per m2
    materials: {
      eps: 0,
      mineral_wool: 15,
      not_sure: 5
    },
    thickness: {
      '5cm': 0,
      '8cm': 5,
      '10cm': 10,
      '12cm': 15,
      'not_sure': 8
    },
    scaffolding: 10 // per m2
  },
  supporting_wall: {
    base: 120, // base price per m2 (height * length)
    materials: {
      concrete: 0,
      stone: 80,
      gabion: 40,
      not_sure: 20
    },
    drainage: 25 // per linear meter
  }
};
