import {useBusiness} from '../hooks/useBusiness';
export default function BusinessBrand() {
  const {business}=useBusiness();
  return <div className="flex min-w-0 items-center gap-3">
    {business.logo ? <img src={business.logo} alt={`Logo de ${business.companyName}`} className="h-9 w-9 shrink-0 rounded-md object-contain"/> :
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">{business.companyName.slice(0,1).toUpperCase()}</div>}
    <span className="min-w-0 break-words text-base font-semibold">{business.companyName}</span>
  </div>;
}
