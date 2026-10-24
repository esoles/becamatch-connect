import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ConsentChoice } from "@/lib/privacy";

export function PrivacyConsent({ value, onChange, id = "privacy", purpose = "crear mi cuenta y gestionar mi perfil y mis becas" }: {
  value: ConsentChoice; onChange: (value: ConsentChoice) => void; id?: string; purpose?: string;
}) {
  return <fieldset className="space-y-3 border-t border-border pt-4 text-sm">
    <legend className="sr-only">Consentimientos de privacidad</legend>
    <p className="text-xs text-warning-foreground">Política demo: responsable y contacto legal pendientes. No ingreses datos sensibles.</p>
    <div className="flex items-start gap-3">
      <Checkbox id={`${id}-legal`} checked={value.legal} onCheckedChange={(checked) => onChange({ ...value, legal: checked === true })} required aria-label="Autorizo el tratamiento de mis datos" />
      <Label htmlFor={`${id}-legal`} className="block leading-relaxed">He leído la <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Privacidad</Link> y autorizo el tratamiento de mis datos para {purpose}. Obligatorio.</Label>
    </div>
    <div className="flex items-start gap-3">
      <Checkbox id={`${id}-email`} checked={value.emailPromotions} onCheckedChange={(checked) => onChange({ ...value, emailPromotions: checked === true })} />
      <Label htmlFor={`${id}-email`} className="block leading-relaxed">Deseo recibir novedades promocionales de becas, eventos y recursos por correo electrónico. Opcional.</Label>
    </div>
    <div className="flex items-start gap-3">
      <Checkbox id={`${id}-whatsapp`} checked={value.whatsappPromotions} onCheckedChange={(checked) => onChange({ ...value, whatsappPromotions: checked === true })} />
      <Label htmlFor={`${id}-whatsapp`} className="block leading-relaxed">Deseo recibir novedades promocionales por WhatsApp, si vinculo mi número. Opcional.</Label>
    </div>
    <p className="text-xs text-muted-foreground">Las promociones no condicionan el servicio ni autorizan envíos automáticos. Puedes retirar esas autorizaciones desde tu perfil.</p>
  </fieldset>;
}