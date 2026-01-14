
export interface Product {
  id: string;
  name: string;
  subtitle?: string; // 추가: 한글 서브 타이틀 등
  price: string;
  category: string;
  image: string;
  detailImages?: string[];
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
