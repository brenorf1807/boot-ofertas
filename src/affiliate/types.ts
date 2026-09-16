export interface AffiliateAdapter {
  /** Nome curto usado nos logs (ex: "amazon"). */
  name: string;
  /** Verifica se este adapter sabe gerar link de afiliado para a URL informada. */
  matches(url: string): boolean;
  /** Recebe o link original e devolve o link com o ID de afiliado aplicado. */
  generate(url: string): string;
}
