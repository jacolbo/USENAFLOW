export async function scanProjectHistory(): Promise<number> {
  console.log(`[DataLearning] AI learning is paused — scanProjectHistory skipped`);
  return 0;
}

export async function scanClientSurveys(): Promise<number> {
  console.log(`[DataLearning] AI learning is paused — scanClientSurveys skipped`);
  return 0;
}

export async function scanClientChats(): Promise<number> {
  console.log(`[DataLearning] AI learning is paused — scanClientChats skipped`);
  return 0;
}

export async function scanRetoucherBehavior(): Promise<number> {
  console.log(`[DataLearning] AI learning is paused — scanRetoucherBehavior skipped`);
  return 0;
}

export async function scanReferralPatterns(): Promise<number> {
  console.log(`[DataLearning] AI learning is paused — scanReferralPatterns skipped`);
  return 0;
}

export async function runFullDataScan(): Promise<{
  projectHistory: number;
  clientSurveys: number;
  clientChats: number;
  retoucherBehavior: number;
  referralPatterns: number;
  total: number;
}> {
  console.log(`[DataLearning] AI learning is paused — full data scan skipped`);
  return {
    projectHistory: 0,
    clientSurveys: 0,
    clientChats: 0,
    retoucherBehavior: 0,
    referralPatterns: 0,
    total: 0,
  };
}
