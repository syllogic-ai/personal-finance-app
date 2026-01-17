// Mock categories for UI testing
// This file should be removed or replaced when connected to real database

export interface MockCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  categoryType: "expense" | "income" | "transfer";
}

export const mockCategories: MockCategory[] = [
  { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
  { id: "cat-2", name: "Software", color: "#3B82F6", icon: "RiCodeLine", categoryType: "expense" },
  { id: "cat-3", name: "Equipment", color: "#6366F1", icon: "RiComputerLine", categoryType: "expense" },
  { id: "cat-4", name: "Transportation", color: "#10B981", icon: "RiCarLine", categoryType: "expense" },
  { id: "cat-5", name: "Utilities", color: "#EF4444", icon: "RiLightbulbLine", categoryType: "expense" },
  { id: "cat-6", name: "Entertainment", color: "#EC4899", icon: "RiMovieLine", categoryType: "expense" },
  { id: "cat-7", name: "Shopping", color: "#8B5CF6", icon: "RiShoppingBagLine", categoryType: "expense" },
  { id: "cat-8", name: "Healthcare", color: "#14B8A6", icon: "RiHospitalLine", categoryType: "expense" },
  { id: "cat-9", name: "Income", color: "#22C55E", icon: "RiWalletLine", categoryType: "income" },
  { id: "cat-10", name: "Transfer", color: "#64748B", icon: "RiExchangeLine", categoryType: "transfer" },
  { id: "cat-11", name: "Other", color: "#78716C", icon: "RiMoreLine", categoryType: "expense" },
  { id: "cat-12", name: "Uncategorized", color: "#A1A1AA", icon: "RiQuestionLine", categoryType: "expense" },
];

export function getCategoryById(id: string): MockCategory | undefined {
  return mockCategories.find((cat) => cat.id === id);
}

export function getCategoriesByType(type: "expense" | "income" | "transfer"): MockCategory[] {
  return mockCategories.filter((cat) => cat.categoryType === type);
}
