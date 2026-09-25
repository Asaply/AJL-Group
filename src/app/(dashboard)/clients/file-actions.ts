"use server";

import {
  getEntityFileUrl,
  registerEntityFile,
  softDeleteEntityFile,
  updateEntityFileType,
  type EntityFilesConfig,
} from "@/lib/entity-file-actions";

const CFG: EntityFilesConfig = { table: "client_files", ownerColumn: "client_id", entity: "client" };

export async function registerClientFile(
  clientId: string,
  meta: {
    storage_path: string;
    file_name: string;
    size_bytes: number;
    mime_type: string | null;
    doc_type: string;
    custom_label: string | null;
  }
) {
  return registerEntityFile(CFG, clientId, meta);
}

export async function softDeleteClientFile(id: string, clientId: string) {
  return softDeleteEntityFile(CFG, id, clientId);
}

export async function updateClientFileType(
  id: string,
  clientId: string,
  docType: string,
  customLabel: string | null
) {
  return updateEntityFileType(CFG, id, clientId, docType, customLabel);
}

export async function getClientFileUrl(id: string, clientId: string, download: boolean) {
  return getEntityFileUrl(CFG, id, clientId, download);
}
