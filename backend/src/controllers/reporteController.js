const db =
  require('../config/db');

const ExcelJS =
  require('exceljs');

// ============================================================
// AUTORIZACIÓN
// ============================================================
//
// Las rutas ya exigen Admin, pero mantenemos esta validación
// como defensa en profundidad.
//
// De esta forma, si un controller llegara a ser utilizado desde
// otra ruta en el futuro, seguiría protegido.
// ============================================================

const esAdminUser = (
  req
) => {
  const rol =
    String(
      req.user?.rol || ''
    )
      .trim()
      .toLowerCase();

  return (
    rol === 'admin' ||
    rol === 'administrador'
  );
};

// ============================================================
// ESTILO DE ENCABEZADOS
// ============================================================

const aplicarEstiloEncabezado = (
  sheet,
  title,
  columns
) => {
  sheet.mergeCells(
    1,
    1,
    1,
    columns.length
  );

  const titleCell =
    sheet.getCell(
      1,
      1
    );

  titleCell.value =
    title;

  titleCell.font = {
    name:
      'Segoe UI',
    size:
      16,
    bold:
      true,
    color: {
      argb:
        'FFFFFF'
    }
  };

  titleCell.alignment = {
    vertical:
      'middle',
    horizontal:
      'center'
  };

  titleCell.fill = {
    type:
      'pattern',
    pattern:
      'solid',
    fgColor: {
      argb:
        '2D3748'
    }
  };

  sheet.getRow(
    1
  ).height = 40;

  // Fila de separación.
  sheet.getRow(
    2
  ).height = 15;

  // ----------------------------------------------------------
  // ENCABEZADOS DE COLUMNAS
  // ----------------------------------------------------------

  const headerRow =
    sheet.getRow(
      3
    );

  headerRow.height =
    25;

  headerRow.values =
    columns.map(
      (
        column
      ) => column.header
    );

  columns.forEach(
    (
      column,
      index
    ) => {
      const cell =
        headerRow.getCell(
          index + 1
        );

      cell.font = {
        name:
          'Segoe UI',
        size:
          11,
        bold:
          true,
        color: {
          argb:
            'FFFFFF'
        }
      };

      cell.fill = {
        type:
          'pattern',
        pattern:
          'solid',
        fgColor: {
          argb:
            '5B9BD5'
        }
      };

      cell.alignment = {
        vertical:
          'middle',
        horizontal:
          'center',
        wrapText:
          true
      };

      cell.border = {
        top: {
          style:
            'medium',
          color: {
            argb:
              '2D3748'
          }
        },
        bottom: {
          style:
            'medium',
          color: {
            argb:
              '2D3748'
          }
        }
      };
    }
  );
};

// ============================================================
// FORMATO DE DATOS
// ============================================================

const finalizarFormatoTabla = (
  sheet,
  startRow,
  totalRows,
  numCols
) => {
  for (
    let rowIndex =
      startRow;
    rowIndex <
      startRow +
        totalRows;
    rowIndex++
  ) {
    const row =
      sheet.getRow(
        rowIndex
      );

    row.height =
      20;

    for (
      let columnIndex =
        1;
      columnIndex <=
        numCols;
      columnIndex++
    ) {
      const cell =
        row.getCell(
          columnIndex
        );

      cell.font = {
        name:
          'Segoe UI',
        size:
          10
      };

      cell.alignment = {
        vertical:
          'middle',
        wrapText:
          true
      };

      cell.border = {
        top: {
          style:
            'thin',
          color: {
            argb:
              'E2E8F0'
          }
        },
        bottom: {
          style:
            'thin',
          color: {
            argb:
              'E2E8F0'
          }
        },
        left: {
          style:
            'thin',
          color: {
            argb:
              'E2E8F0'
          }
        },
        right: {
          style:
            'thin',
          color: {
            argb:
              'E2E8F0'
          }
        }
      };
    }
  }

  // ----------------------------------------------------------
  // AUTOAJUSTE
  // ----------------------------------------------------------

  sheet.columns.forEach(
    (
      column
    ) => {
      let maxLen =
        0;

      column.eachCell(
        {
          includeEmpty:
            true
        },
        (
          cell
        ) => {
          const value =
            cell.value;

          let valueLength =
            0;

          if (
            value !==
              null &&
            value !==
              undefined
          ) {
            valueLength =
              String(
                value
              ).length;
          }

          if (
            valueLength >
            maxLen
          ) {
            maxLen =
              valueLength;
          }
        }
      );

      // Evitamos columnas excesivamente anchas.
      column.width =
        Math.min(
          Math.max(
            maxLen + 4,
            12
          ),
          60
        );
    }
  );
};

// ============================================================
// CONFIGURAR WORKBOOK
// ============================================================

const configurarWorkbook = (
  workbook,
  nombreReporte
) => {
  workbook.creator =
    'ArchiveX';

  workbook.lastModifiedBy =
    'ArchiveX';

  workbook.created =
    new Date();

  workbook.modified =
    new Date();

  workbook.properties = {
    title:
      nombreReporte,
    subject:
      nombreReporte,
    company:
      'ArchiveX'
  };
};

// ============================================================
// CONFIGURAR RESPUESTA EXCEL
// ============================================================

const prepararRespuestaExcel = (
  res,
  nombreArchivo
) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${nombreArchivo}"`
  );

  // Los reportes pueden contener información institucional.
  // Evitamos que el navegador o proxies compartidos los
  // almacenen innecesariamente.
  res.setHeader(
    'Cache-Control',
    'private, no-store, max-age=0'
  );

  res.setHeader(
    'Pragma',
    'no-cache'
  );

  res.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );
};

// ============================================================
// VALIDACIÓN GENERAL DEL CONTROLLER
// ============================================================

const validarAccesoAdmin = (
  req,
  res
) => {
  if (
    !req.user
  ) {
    res.status(401).json({
      status:
        'error',
      message:
        'No autenticado.'
    });

    return false;
  }

  if (
    !esAdminUser(req)
  ) {
    res.status(403).json({
      status:
        'error',
      message:
        'No tienes permisos para consultar reportes administrativos.'
    });

    return false;
  }

  return true;
};

// ============================================================
// 1. REPORTE GENERAL DE CONVOCATORIAS
// ============================================================

exports.getReporteConvocatorias =
  async (
    req,
    res
  ) => {
    try {
      if (
        !validarAccesoAdmin(
          req,
          res
        )
      ) {
        return;
      }

      const query = `
        SELECT
          c.codigo,
          c.titulo,
          c.tipo,

          COUNT(s.id) AS total_proyectos,

          SUM(
            CASE
              WHEN s.estado = 'Borrador'
              THEN 1
              ELSE 0
            END
          ) AS borradores,

          SUM(
            CASE
              WHEN s.estado = 'Radicado'
              THEN 1
              ELSE 0
            END
          ) AS radicados,

          SUM(
            CASE
              WHEN s.estado = 'En Evaluación'
              THEN 1
              ELSE 0
            END
          ) AS en_evaluacion,

          SUM(
            CASE
              WHEN s.estado = 'Aprobado'
              THEN 1
              ELSE 0
            END
          ) AS aprobados,

          SUM(
            CASE
              WHEN s.estado = 'Rechazado'
              THEN 1
              ELSE 0
            END
          ) AS rechazados

        FROM convocatorias c

        LEFT JOIN solicitudes s
          ON c.id =
             s.convocatoria_id

        GROUP BY
          c.id,
          c.codigo,
          c.titulo,
          c.tipo

        ORDER BY
          c.created_at DESC
      `;

      const [
        rows
      ] =
        await db.query(
          query
        );

      const workbook =
        new ExcelJS.Workbook();

      configurarWorkbook(
        workbook,
        'Reporte General de Convocatorias - ArchiveX'
      );

      const sheet =
        workbook.addWorksheet(
          'Convocatorias'
        );

      const columns = [
        {
          header:
            'Código'
        },
        {
          header:
            'Título Convocatoria'
        },
        {
          header:
            'Tipo'
        },
        {
          header:
            'Total Proyectos'
        },
        {
          header:
            'Borradores'
        },
        {
          header:
            'Radicados'
        },
        {
          header:
            'En Evaluación'
        },
        {
          header:
            'Aprobados'
        },
        {
          header:
            'Rechazados'
        }
      ];

      aplicarEstiloEncabezado(
        sheet,
        'REPORTE GENERAL DE CONVOCATORIAS - ARCHIVEX',
        columns
      );

      rows.forEach(
        (
          row
        ) => {
          sheet.addRow([
            row.codigo,
            row.titulo,
            row.tipo,
            Number(
              row.total_proyectos ||
                0
            ),
            Number(
              row.borradores ||
                0
            ),
            Number(
              row.radicados ||
                0
            ),
            Number(
              row.en_evaluacion ||
                0
            ),
            Number(
              row.aprobados ||
                0
            ),
            Number(
              row.rechazados ||
                0
            )
          ]);
        }
      );

      finalizarFormatoTabla(
        sheet,
        4,
        rows.length,
        columns.length
      );

      prepararRespuestaExcel(
        res,
        'Reporte_Convocatorias_ArchiveX.xlsx'
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();
    } catch (error) {
      console.error(
        'Error generando reporte de convocatorias:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'No fue posible generar el reporte de convocatorias.'
      });
    }
  };

// ============================================================
// 2. DEMOGRAFÍA POR SEDES
// ============================================================

exports.getReporteSedesDemografia =
  async (
    req,
    res
  ) => {
    try {
      if (
        !validarAccesoAdmin(
          req,
          res
        )
      ) {
        return;
      }

      const query = `
        SELECT
          sd.nombre_sede,
          u.carrera_titulo,
          u.nivel_educativo,
          COUNT(u.id) AS total_profesores

        FROM usuarios u

        INNER JOIN solicitudes s
          ON u.id =
             s.usuario_id

        INNER JOIN sedes sd
          ON s.sede_id =
             sd.id

        WHERE u.rol = 'Profesor'

        GROUP BY
          sd.nombre_sede,
          u.carrera_titulo,
          u.nivel_educativo

        ORDER BY
          sd.nombre_sede ASC,
          total_profesores DESC
      `;

      const [
        rows
      ] =
        await db.query(
          query
        );

      const workbook =
        new ExcelJS.Workbook();

      configurarWorkbook(
        workbook,
        'Demografía de Profesores por Sede - ArchiveX'
      );

      const sheet =
        workbook.addWorksheet(
          'Demografía por Sedes'
        );

      const columns = [
        {
          header:
            'Sede Universitaria'
        },
        {
          header:
            'Título Profesional / Carrera'
        },
        {
          header:
            'Nivel Educativo alcanzado'
        },
        {
          header:
            'Cantidad de Profesores'
        }
      ];

      aplicarEstiloEncabezado(
        sheet,
        'DEMOGRAFÍA ASIGNADA DE PROFESORES POR SEDE',
        columns
      );

      rows.forEach(
        (
          row
        ) => {
          sheet.addRow([
            row.nombre_sede,
            row.carrera_titulo ||
              'No registrado',
            row.nivel_educativo ||
              'No registrado',
            Number(
              row.total_profesores ||
                0
            )
          ]);
        }
      );

      finalizarFormatoTabla(
        sheet,
        4,
        rows.length,
        columns.length
      );

      prepararRespuestaExcel(
        res,
        'Reporte_Demografia_Sedes.xlsx'
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();
    } catch (error) {
      console.error(
        'Error generando reporte de demografía:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'No fue posible generar el reporte de demografía.'
      });
    }
  };

// ============================================================
// 3. CONTROL DE EVALUADORES
// ============================================================

exports.getReporteEvaluadores =
  async (
    req,
    res
  ) => {
    try {
      if (
        !validarAccesoAdmin(
          req,
          res
        )
      ) {
        return;
      }

      const query = `
        SELECT
          u.nombre_completo AS evaluador,
          u.email,

          COUNT(ae.id) AS total_asignados,

          SUM(
            CASE
              WHEN ae.estado_evaluacion = 'Asignado'
              THEN 1
              ELSE 0
            END
          ) AS asignados,

          SUM(
            CASE
              WHEN ae.estado_evaluacion = 'En Progreso'
              THEN 1
              ELSE 0
            END
          ) AS en_progreso,

          SUM(
            CASE
              WHEN ae.estado_evaluacion = 'Finalizado'
              THEN 1
              ELSE 0
            END
          ) AS finalizados,

          IFNULL(
            AVG(
              CASE
                WHEN ae.estado_evaluacion = 'Finalizado'
                THEN ae.puntaje
              END
            ),
            0.00
          ) AS promedio_puntaje

        FROM usuarios u

        LEFT JOIN asignacion_evaluaciones ae
          ON u.id =
             ae.evaluador_id

        WHERE u.rol = 'Evaluador'

        GROUP BY
          u.id,
          u.nombre_completo,
          u.email

        ORDER BY
          total_asignados DESC
      `;

      const [
        rows
      ] =
        await db.query(
          query
        );

      const workbook =
        new ExcelJS.Workbook();

      configurarWorkbook(
        workbook,
        'Control de Evaluadores - ArchiveX'
      );

      const sheet =
        workbook.addWorksheet(
          'Evaluadores'
        );

      const columns = [
        {
          header:
            'Nombre Evaluador'
        },
        {
          header:
            'Correo Electrónico'
        },
        {
          header:
            'Total Asignados'
        },
        {
          header:
            'Estado: Asignado'
        },
        {
          header:
            'Estado: En Progreso'
        },
        {
          header:
            'Estado: Finalizado'
        },
        {
          header:
            'Puntaje Promedio Otorgado'
        }
      ];

      aplicarEstiloEncabezado(
        sheet,
        'INFORME Y CONTROL DE EVALUADORES - ARCHIVEX',
        columns
      );

      rows.forEach(
        (
          row
        ) => {
          sheet.addRow([
            row.evaluador,
            row.email,
            Number(
              row.total_asignados ||
                0
            ),
            Number(
              row.asignados ||
                0
            ),
            Number(
              row.en_progreso ||
                0
            ),
            Number(
              row.finalizados ||
                0
            ),
            Number(
              row.promedio_puntaje ||
                0
            )
          ]);
        }
      );

      // Formato numérico del promedio.
      rows.forEach(
        (
          row,
          index
        ) => {
          const excelRow =
            sheet.getRow(
              index + 4
            );

          excelRow.getCell(
            7
          ).numFmt =
            '0.00';
        }
      );

      finalizarFormatoTabla(
        sheet,
        4,
        rows.length,
        columns.length
      );

      prepararRespuestaExcel(
        res,
        'Reporte_Control_Evaluadores.xlsx'
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();
    } catch (error) {
      console.error(
        'Error generando reporte de evaluadores:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'No fue posible generar el reporte de evaluadores.'
      });
    }
  };

// ============================================================
// 4. PROYECTOS Y TÍTULOS ASOCIADOS
// ============================================================

exports.getReporteProyectosTitulos =
  async (
    req,
    res
  ) => {
    try {
      if (
        !validarAccesoAdmin(
          req,
          res
        )
      ) {
        return;
      }

      const query = `
        SELECT
          s.num_solicitud,
          s.titulo_propuesta,
          s.estado,

          u.nombre_completo AS docente,
          u.nivel_educativo,
          u.carrera_titulo,

          sd.nombre_sede

        FROM solicitudes s

        INNER JOIN usuarios u
          ON s.usuario_id =
             u.id

        INNER JOIN sedes sd
          ON s.sede_id =
             sd.id

        ORDER BY
          s.created_at DESC
      `;

      const [
        rows
      ] =
        await db.query(
          query
        );

      const workbook =
        new ExcelJS.Workbook();

      configurarWorkbook(
        workbook,
        'Auditoría de Proyectos y Títulos - ArchiveX'
      );

      const sheet =
        workbook.addWorksheet(
          'Proyectos y Títulos'
        );

      const columns = [
        {
          header:
            'N° Radicado'
        },
        {
          header:
            'Título de la Propuesta'
        },
        {
          header:
            'Estado Actual'
        },
        {
          header:
            'Docente Investigador'
        },
        {
          header:
            'Nivel Académico'
        },
        {
          header:
            'Carrera Profesional'
        },
        {
          header:
            'Sede Asociada'
        }
      ];

      aplicarEstiloEncabezado(
        sheet,
        'AUDITORÍA CONSOLIDADA DE PROYECTOS Y TÍTULOS',
        columns
      );

      rows.forEach(
        (
          row
        ) => {
          sheet.addRow([
            row.num_solicitud,
            row.titulo_propuesta,
            row.estado,
            row.docente,
            row.nivel_educativo ||
              'No especificado',
            row.carrera_titulo ||
              'No especificado',
            row.nombre_sede
          ]);
        }
      );

      finalizarFormatoTabla(
        sheet,
        4,
        rows.length,
        columns.length
      );

      prepararRespuestaExcel(
        res,
        'Reporte_Proyectos_Titulos.xlsx'
      );

      await workbook.xlsx.write(
        res
      );

      return res.end();
    } catch (error) {
      console.error(
        'Error generando reporte de proyectos:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'No fue posible generar el reporte de proyectos y títulos.'
      });
    }
  };