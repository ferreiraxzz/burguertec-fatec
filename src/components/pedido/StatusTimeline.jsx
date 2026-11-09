import React from "react";
import { ETAPAS_STATUS, formatarHora, horariosPorStatus, rotuloStatus } from "../../lib/pedido.js";

/** Linha do tempo recebido → em preparo → saiu/pronto → entregue, com o horário de cada etapa. */
export default function StatusTimeline({ status, retirada, historico }) {
  const horarios = horariosPorStatus(historico);

  if (status === "cancelado") {
    return (
      <p className="pedido__cancelado">
        Este pedido foi cancelado
        {horarios.cancelado ? ` às ${formatarHora(horarios.cancelado)}` : ""}.
      </p>
    );
  }

  const atual = ETAPAS_STATUS.indexOf(status);
  return (
    <ol className="timeline" aria-label="Andamento do pedido">
      {ETAPAS_STATUS.map((etapa, i) => {
        const estado = i < atual ? "feito" : i === atual ? "atual" : "pendente";
        const horario = horarios[etapa];
        return (
          <li
            key={etapa}
            className={`timeline__etapa timeline__etapa--${estado}`}
            aria-current={estado === "atual" ? "step" : undefined}
          >
            <span className="timeline__ponto" aria-hidden="true" />
            <span className="timeline__rotulo">{rotuloStatus(etapa, retirada)}</span>
            {horario && estado !== "pendente" && (
              <time className="timeline__hora" dateTime={horario}>
                {formatarHora(horario)}
              </time>
            )}
          </li>
        );
      })}
    </ol>
  );
}
