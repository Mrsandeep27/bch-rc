import { WhatsAppIcon } from "@/components/BrandIcons";
import { waLink } from "@/lib/config";

export default function WhatsAppFab() {
  return (
    <a
      target="_blank"
      rel="noopener"
      href={waLink("Hi, I want to order the mini RC drift car.")}
      aria-label="Chat on WhatsApp"
      className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-whatsapp-green hover:bg-whatsapp-green-hover text-white flex items-center justify-center shadow-2xl ring-4 ring-white"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
