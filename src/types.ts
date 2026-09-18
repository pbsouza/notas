export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  fontFamily?: string;
  fontSize?: string;
}

export interface WorkspaceState {
  roomId: string;
  notes: Note[];
  activeNoteId: string;
}

export type ExportFormatId =
  | 'txt'
  | 'tft'
  | 'pdf'
  | 'doc'
  | 'docx'
  | 'bat'
  | 'html'
  | 'md'
  | 'json'
  | 'sh'
  | 'py'
  | 'js'
  | 'rtf'
  | 'csv';

export interface ExportFormatOption {
  id: ExportFormatId;
  label: string;
  extension: string;
  mimeType: string;
  category: 'documentos' | 'texto' | 'scripts' | 'codigo' | 'dados';
  description: string;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  browser?: string;
  os?: string;
  isSelf?: boolean;
  color: string;
  lastSeen: number;
  currentNoteId?: string;
  isTyping?: boolean;
}

export interface SyncMessage {
  type:
    | 'join'
    | 'leave'
    | 'init'
    | 'note_update'
    | 'note_delete'
    | 'note_create'
    | 'presence'
    | 'typing';
  roomId: string;
  deviceId: string;
  deviceName?: string;
  deviceColor?: string;
  note?: Note;
  notes?: Note[];
  noteId?: string;
  isTyping?: boolean;
  timestamp: number;
}

export type EditorFont = 'mono' | 'sans' | 'serif' | string;
export type EditorTheme = 'default' | 'paper' | 'dark' | 'sepia' | 'terminal';
export type NotesViewLayout = 'comfortable' | 'compact' | 'cards' | 'grid';
export type EditorMode = 'rich' | 'plain';

export interface AdvancedSearchFilter {
  query: string;
  dateField: 'all' | 'created' | 'updated';
  dateRange: 'all' | 'today' | '7days' | '30days' | 'custom';
  startDate?: string;
  endDate?: string;
  pinnedOnly: boolean;
  sortBy: 'updated-desc' | 'updated-asc' | 'created-desc' | 'created-asc' | 'title-asc' | 'title-desc';
}
