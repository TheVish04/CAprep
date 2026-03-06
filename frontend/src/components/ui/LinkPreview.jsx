import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { encode } from "qss";
import React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import "./LinkPreview.css";

export const LinkPreview = ({
  children,
  url,
  className = "",
  width = 200,
  height = 125,
  quality = 50,
  isStatic = false,
  imageSrc = ""
}) => {
  let src;
  if (!isStatic) {
    const params = encode({
      url,
      screenshot: true,
      meta: false,
      embed: "screenshot.url",
      colorScheme: "dark",
      "viewport.isMobile": true,
      "viewport.deviceScaleFactor": 1,
      "viewport.width": width * 3,
      "viewport.height": height * 3,
    });
    // Use the direct image service from Microlink if available, or stick to api with proper embed
    src = `https://api.microlink.io/?${params}`;
  } else {
    src = imageSrc;
  }

  const [isOpen, setOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const springConfig = { stiffness: 260, damping: 20 };
  const x = useMotionValue(0);
  const translateX = useSpring(x, springConfig);

  const handleMouseMove = (event) => {
    const targetRect = event.currentTarget.getBoundingClientRect();
    const eventOffsetX = event.clientX - targetRect.left;
    const offsetFromCenter = (eventOffsetX - targetRect.width / 2) / 2;
    x.set(offsetFromCenter);
  };

  return (
    <>
      {isMounted ? (
        <div style={{ display: "none" }}>
          <img src={src} width={width} height={height} alt="hidden image" />
        </div>
      ) : null}
      <HoverCardPrimitive.Root
        openDelay={50}
        closeDelay={100}
        onOpenChange={(open) => {
          setOpen(open);
        }}>
        <HoverCardPrimitive.Trigger
          onMouseMove={handleMouseMove}
          className={`link-preview-trigger ${className}`}
          href={url}>
          {children}
        </HoverCardPrimitive.Trigger>

        <HoverCardPrimitive.Content
          className="link-preview-content"
          side="top"
          align="center"
          sideOffset={10}>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                className="link-preview-card"
                style={{
                  x: translateX,
                }}>
                <a
                  href={url}
                  className="link-preview-link"
                  style={{ fontSize: 0, position: "relative" }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={isStatic ? imageSrc : src}
                    width={width}
                    height={height}
                    className="link-preview-image"
                    alt="preview image"
                    onLoad={() => setIsMounted(true)} // Reuse mounted for loading state if needed, but better to have dedicated state
                  />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Root>
    </>
  );
};
