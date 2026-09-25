"use server";

import {
  getEntityFileUrl,
  registerEntityFile,
  softDeleteEntityFile,
  updateEntityFileType,
  type EntityFilesConfig,
} from "@/lib/entity-file-actions";

const CFG: EntityFilesConfig = { table: "project_files", ownerColumn: "project_id", entity: "project" };

export async function registerProjectFile(
  projectId: string,
  meta: {
    storage_path: string;
    file_name: string;
    size_bytes: number;
    mime_type: string | null;
    doc_type: string;
    custom_label: string | null;
  }
) {
  return registerEntityFile(CFG, projectId, meta);
}

export async function softDeleteProjectFile(id: string, projectId: string) {
  return softDeleteEntityFile(CFG, id, projectId);
}

export async function updateProjectFileType(
  id: string,
  projectId: string,
  docType: string,
  customLabel: string | null
) {
  return updateEntityFileType(CFG, id, projectId, docType, customLabel);
}

export async function getProjectFileUrl(id: string, projectId: string, download: boolean) {
  return getEntityFileUrl(CFG, id, projectId, download);
}
