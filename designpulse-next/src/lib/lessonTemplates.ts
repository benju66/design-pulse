import { LessonTemplate } from '@/types/models';

export const LESSON_TEMPLATES: LessonTemplate[] = [
  {
    id: 'material_substitution',
    label: 'Material Substitution Issue',
    defaultCategory: 'Design',
    whatHappenedPlaceholder: 'Describe the material that was substituted and what issue arose...',
    rootCausePlaceholder: 'Why was the substitute material incompatible or inadequate?',
    recommendationPlaceholder: 'What checks should be performed before approving material substitutions?',
  },
  {
    id: 'subcontractor_performance',
    label: 'Subcontractor Performance',
    defaultCategory: 'Procurement',
    whatHappenedPlaceholder: 'Describe the subcontractor issue (scheduling, quality, scope gaps)...',
    rootCausePlaceholder: 'What contributed to the performance issue (bid gaps, unclear scope, capacity)?',
    recommendationPlaceholder: 'What contract terms, pre-qualification, or oversight should be added?',
  },
  {
    id: 'ahj_requirement',
    label: 'AHJ Requirement',
    defaultCategory: 'Coordination',
    whatHappenedPlaceholder: 'Describe the Authority Having Jurisdiction requirement that impacted the project...',
    rootCausePlaceholder: "Why wasn't this requirement identified earlier in pre-construction?",
    recommendationPlaceholder: 'What AHJ research or outreach should be conducted on future projects?',
  },
  {
    id: 'owner_specific',
    label: 'Owner Specific',
    defaultCategory: 'Client/Owner',
    whatHappenedPlaceholder: 'Describe the owner-specific requirement, preference, or standard...',
    rootCausePlaceholder: "Why wasn't this captured during initial programming or brand standard review?",
    recommendationPlaceholder: 'What should be added to the client profile or project kickoff checklist?',
  },
];
