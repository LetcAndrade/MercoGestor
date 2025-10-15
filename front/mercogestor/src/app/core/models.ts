export interface Product {
  id: string;
  nome: string;
  sku?: string;
  categoria?: string;
  unidade: 'un' | 'kg' | 'g' | 'l' | 'ml' | 'cx' | string;
  preco?: number;            // opcional (para relatórios)
  minimo?: number;           // estoque mínimo para alerta
  // Se quiser controlar validade por lote, use no Movement (entrada)
}

export type MovementType = 'in' | 'out';

export type MovementReason = 'sale' | 'consumption' | 'waste'; // venda/consumo/perda

export interface Movement {
  id: string;
  productId: string;
  tipo: MovementType;
  quantidade: number;
  dataISO: string;           // new Date().toISOString()
  precoUnitario?: number;    // opcional
  validadeLote?: string;     // YYYY-MM-DD (para entradas)
  motivo?: MovementReason;   // para saídas
}

export interface User {
  id: string;
  nome: string;
  email?: string;
  role: 'admin' | 'operador' | 'visualizador';
}

export interface BackupPayload {
  criadoEm: string;
  products: Product[];
  movements: Movement[];
  users: User[];
}
