import { useBusiness } from "../hooks/useBusiness";
export default function PixPayment() {
  const { business } = useBusiness();
  return (
    <div className="rounded border p-3 space-y-2" role="status">
      <strong>Pagamento via Pix</strong>
      {business.pixQrCode && (
        <img
          src={business.pixQrCode}
          alt="QR Code Pix do estabelecimento"
          className="h-56 w-56 object-contain mx-auto"
        />
      )}
      {business.pixKey && (
        <p className="break-all">
          Chave Pix: <strong>{business.pixKey}</strong>
        </p>
      )}
      {!business.pixKey && !business.pixQrCode && (
        <p>Cadastre a chave ou o QR Code Pix em Configurações.</p>
      )}
      <p className="text-sm">
        Confira o recebimento na conta antes de concluir o pagamento.
      </p>
    </div>
  );
}
