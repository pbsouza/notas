export interface FontOption {
  id: string;
  name: string;
  category: 'sans' | 'serif' | 'mono' | 'display' | 'handwriting';
  categoryLabel: string;
  fontFamily: string;
  sample: string;
}

export const FONT_OPTIONS: FontOption[] = [
  // Sans-Serif Fonts (Modern & Clean - like Word / Google Docs)
  {
    id: 'calibri',
    name: 'Calibri',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "Calibri, Candara, 'Segoe UI', Arial, sans-serif",
    sample: 'Padrão clássico do Microsoft Word',
  },
  {
    id: 'arial',
    name: 'Arial',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
    sample: 'Limpa, universal e altamente legível',
  },
  {
    id: 'inter',
    name: 'Inter',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "'Inter', sans-serif",
    sample: 'Moderna e projetada para telas digitais',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "'Roboto', sans-serif",
    sample: 'Geométrica com curvas amigáveis',
  },
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    sample: 'Elegante e contemporânea',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "'Montserrat', sans-serif",
    sample: 'Visual editorial refinado',
  },
  {
    id: 'verdana',
    name: 'Verdana',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "Verdana, Geneva, sans-serif",
    sample: 'Excelente legibilidade em qualquer tamanho',
  },
  {
    id: 'trebuchet',
    name: 'Trebuchet MS',
    category: 'sans',
    categoryLabel: 'Sem Serifa',
    fontFamily: "'Trebuchet MS', 'Lucida Grande', sans-serif",
    sample: 'Dinâmica com toques humanistas',
  },

  // Serif Fonts (Academic, Legal, Books)
  {
    id: 'times',
    name: 'Times New Roman',
    category: 'serif',
    categoryLabel: 'Com Serifa',
    fontFamily: "'Times New Roman', Times, Baskerville, serif",
    sample: 'Tradicional em documentos e artigos acadêmicos',
  },
  {
    id: 'georgia',
    name: 'Georgia',
    category: 'serif',
    categoryLabel: 'Com Serifa',
    fontFamily: "Georgia, 'Times New Roman', serif",
    sample: 'Elegante com leitura confortável',
  },
  {
    id: 'garamond',
    name: 'Garamond',
    category: 'serif',
    categoryLabel: 'Com Serifa',
    fontFamily: "Garamond, Baskerville, 'Hoefler Text', serif",
    sample: 'Clássico editorial e literário',
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    category: 'serif',
    categoryLabel: 'Com Serifa',
    fontFamily: "'Merriweather', Georgia, serif",
    sample: 'Serifa moderna projetada para leitura densa',
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    category: 'serif',
    categoryLabel: 'Com Serifa',
    fontFamily: "'Playfair Display', Georgia, serif",
    sample: 'Títulos imponentes e sofisticados',
  },

  // Monospace Fonts (Code, Technical & Typewriter)
  {
    id: 'courier',
    name: 'Courier New',
    category: 'mono',
    categoryLabel: 'Monoespaçada',
    fontFamily: "'Courier New', Courier, monospace",
    sample: 'Estilo clássico de máquina de escrever',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    category: 'mono',
    categoryLabel: 'Monoespaçada',
    fontFamily: "'JetBrains Mono', monospace",
    sample: 'Moderna para programação e notas técnicas',
  },

  // Handwriting & Casual Fonts
  {
    id: 'caveat',
    name: 'Caveat (Manuscrita)',
    category: 'handwriting',
    categoryLabel: 'Manuscrita',
    fontFamily: "'Caveat', cursive",
    sample: 'Estilo manuscrito pessoal e acolhedor',
  },
  {
    id: 'comic-sans',
    name: 'Comic Sans MS',
    category: 'handwriting',
    categoryLabel: 'Descontraída',
    fontFamily: "'Comic Sans MS', 'Comic Sans', cursive",
    sample: 'Descontraída e informal',
  },
];

export const FONT_SIZES = [
  { label: '9', value: '12px', execSize: '1' },
  { label: '10', value: '13px', execSize: '2' },
  { label: '11', value: '14.5px', execSize: '2' },
  { label: '12', value: '16px', execSize: '3' },
  { label: '14', value: '18px', execSize: '4' },
  { label: '16', value: '21px', execSize: '4' },
  { label: '18', value: '24px', execSize: '5' },
  { label: '20', value: '26px', execSize: '5' },
  { label: '24', value: '32px', execSize: '6' },
  { label: '28', value: '37px', execSize: '6' },
  { label: '32', value: '42px', execSize: '7' },
  { label: '36', value: '48px', execSize: '7' },
  { label: '48', value: '64px', execSize: '7' },
];
