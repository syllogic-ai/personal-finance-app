"use client";
import * as React from "react";
import { RiArrowDownSLine } from "@remixicon/react";
import { T } from "./_tokens";

const inputStyle: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  padding: "7px 10px",
  fontSize: 12,
  fontFamily: "inherit",
  color: T.fg,
  width: "100%",
  outline: "none",
};

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return <input {...rest} style={{ ...inputStyle, ...style }} />;
}

export function SelectWithChevron(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode;
  },
) {
  return (
    <div style={{ position: "relative" }}>
      <select
        {...props}
        style={{
          ...inputStyle,
          appearance: "none",
          paddingRight: 28,
          cursor: "pointer",
        }}
      />
      <RiArrowDownSLine
        size={14}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          color: T.mutedFg,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function Field({
  label,
  flex,
  children,
}: {
  label: React.ReactNode;
  flex?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex }}>
      <div
        style={{
          fontSize: 10,
          color: T.mutedFg,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export const btnGhost: React.CSSProperties = {
  padding: "7px 16px",
  background: "transparent",
  border: `1px solid ${T.border}`,
  fontFamily: "inherit",
  fontSize: 12,
  cursor: "pointer",
  color: T.mutedFg,
};

export const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 18px",
  background: T.primary,
  color: T.primaryFg,
  border: "none",
  fontFamily: "inherit",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 500,
};
