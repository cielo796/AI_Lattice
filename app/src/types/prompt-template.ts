export interface PromptTemplateVersion {
  id: string;
  tenantId: string;
  promptTemplateId: string;
  version: number;
  modelName: string;
  instructions: string;
  responseSchemaJson?: Record<string, unknown>;
  isActive: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  operation: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  activeVersion?: PromptTemplateVersion;
  versions?: PromptTemplateVersion[];
  versionCount?: number;
}

