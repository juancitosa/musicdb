import { motion } from "framer-motion";

export default function PopularityBar({ value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <span className="w-12 text-right text-sm font-medium text-muted-foreground">{value}/100</span>
    </div>
  );
}
