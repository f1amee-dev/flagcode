import type { CtfCategory } from "@flagcode/contracts";
import { CTF_CATEGORIES } from "@flagcode/shared/ctf";
import { memo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  FingerprintIcon,
  GlobeIcon,
  LockIcon,
  PuzzleIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { cn } from "~/lib/utils";

export const CATEGORY_ICON_MAP: Record<CtfCategory, LucideIcon> = {
  crypto: LockIcon,
  pwn: ShieldIcon,
  "reverse-engineering": SearchIcon,
  web: GlobeIcon,
  forensics: FingerprintIcon,
  misc: PuzzleIcon,
};

export const CtfCategoryPicker = memo(function CtfCategoryPicker(props: {
  value: CtfCategory | null;
  onChange: (category: CtfCategory | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectedCategory = props.value ? CTF_CATEGORIES.find((c) => c.id === props.value) : null;

  const CategoryIcon = props.value ? CATEGORY_ICON_MAP[props.value] : null;

  const handleSelect = (category: CtfCategory | null) => {
    if (props.disabled) return;
    props.onChange(category);
    setIsMenuOpen(false);
  };

  return (
    <Menu
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (props.disabled) {
          setIsMenuOpen(false);
          return;
        }
        setIsMenuOpen(open);
      }}
    >
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "min-w-0 justify-start overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 [&_svg]:mx-0",
              props.compact ? "max-w-42 shrink-0" : "max-w-48 shrink sm:max-w-56 sm:px-3",
            )}
            disabled={props.disabled}
          />
        }
      >
        <span
          className={cn(
            "flex min-w-0 w-full box-border items-center gap-2 overflow-hidden",
            props.compact ? "max-w-36 sm:pl-1" : undefined,
          )}
        >
          {CategoryIcon ? (
            <CategoryIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
          ) : null}
          <span className="min-w-0 flex-1 truncate">{selectedCategory?.label ?? "Category"}</span>
          <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
        </span>
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuItem
          className="grid min-h-8 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-sm"
          onClick={() => handleSelect(null)}
        >
          <span className="col-start-1 flex items-center justify-center">
            {props.value === null ? <CheckIcon className="size-3.5" /> : null}
          </span>
          <span className="col-start-2 flex items-center gap-2">
            <XIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
            None
          </span>
        </MenuItem>
        {CTF_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICON_MAP[category.id];
          const isSelected = props.value === category.id;
          return (
            <MenuItem
              key={category.id}
              className="grid min-h-8 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-sm"
              onClick={() => handleSelect(category.id)}
            >
              <span className="col-start-1 flex items-center justify-center">
                {isSelected ? <CheckIcon className="size-3.5" /> : null}
              </span>
              <span className="col-start-2 flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
                {category.label}
              </span>
            </MenuItem>
          );
        })}
      </MenuPopup>
    </Menu>
  );
});
