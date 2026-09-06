export type ProblemExample = { input: string; output: string; explanation?: string };

export type ProblemDefinition = {
  id: string;
  statement: string;
  inputSpec: string;
  outputSpec: string;
  constraints: string[];
  examples: ProblemExample[];
};

export const problemDefinitions: Record<string, ProblemDefinition> = {
  "112-2": {
    id: "112-2",
    statement: "讀入兩個英文單字，計算把第一個單字轉換成第二個單字所需的最小編輯距離。允許插入、刪除與取代；插入與刪除成本為 1，取代成本為 2。",
    inputSpec: "第一行輸入第一個英文單字；第二行輸入第二個英文單字。每個單字長度不超過 20，且只包含英文字母。",
    outputSpec: "輸出由第一個單字轉換成第二個單字所需的最小編輯距離。",
    constraints: ["使用 C# 字串索引可寫成 word[i]。", "建議以動態規劃 D(i, j) 解題。", "空字串邊界需納入計算。"],
    examples: [
      { input: "idea\ndeal", output: "2", explanation: "刪除 i，再於末尾插入 l。" },
      { input: "but\nbait", output: "3", explanation: "將 u 取代為 a，再插入 i。" },
    ],
  },
};
