import React from "react";

export default function Photo({ src, className, pos }) {
  return (
    <div
      className={className}
      style={{ backgroundImage: `url(${src})`, backgroundPosition: pos || "bottom" }}
    />
  );
}
