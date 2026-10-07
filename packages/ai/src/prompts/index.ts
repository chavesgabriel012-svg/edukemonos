// Registry of versioned prompts. Each prompt is added in the phase that needs it
// (curriculum structuring in Phase 1, generators in Phase 2, tutor in Phase 4).
export { definePrompt, renderPrompt, type PromptDefinition } from "./define";
export { structureCurriculumSystem, structureCurriculumUser } from "./structure-curriculum";
export {
  generateMaterialsSystem,
  generateMaterialsUser,
  repairMaterialSystem,
  repairMaterialUser,
  reviewMaterialsSystem,
  reviewMaterialsUser,
} from "./generate-materials";
export { generateItemsSystem, generateItemsUser, solveItemsSystem, solveItemsUser } from "./generate-items";
export { tutorSystem, tutorTurnContext, writingFeedbackSystem } from "./tutor";
export { teacherSummarySystem, teacherSummaryUser } from "./teacher";
