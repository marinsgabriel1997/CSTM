//! Geometria do menu em cascata: posição de cada coluna e da janela do picker que as contém.
//!
//! A janela é a caixa que envolve as colunas visíveis. A coluna principal não muda de lugar
//! na tela: o que muda é a origem da janela, e por isso cada coluna é devolvida em
//! coordenadas relativas a ela. A regra é a de `docs/telas.md` (Tela 2, Navegação nas
//! pastas) e a mesma do protótipo `docs/prototipo/picker.html`.

use serde::{Deserialize, Serialize};

use crate::picker::Area;

/// Largura lógica das subcolunas.
pub const SUB_WIDTH: f64 = 300.0;
/// Intervalo lógico entre dois cartões.
pub const GAP: f64 = 2.0;
/// Distância lógica entre o topo do cartão e a primeira linha da lista (borda e margem
/// interna): com ela, a primeira linha da subcoluna fica na altura da pasta que a abriu.
pub const LIST_INSET: f64 = 5.0;

/// Subcoluna aberta, em pixels lógicos. A pasta que a abriu fica na coluna anterior.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subcolumn {
    /// Altura que o conteúdo ocupa, sem rolagem.
    pub content_height: f64,
    /// Distância do topo da linha da pasta ao topo da coluna anterior, já com a rolagem dela.
    pub anchor_y: f64,
}

/// Posição de uma coluna, em pixels lógicos relativos ao canto superior esquerdo da janela.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct PlacedColumn {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// Coberta por uma coluna mais nova: sai de vista até essa coluna fechar.
    pub hidden: bool,
}

/// Janela (em pixels físicos, na tela) e colunas: a principal primeiro, depois as subcolunas.
#[derive(Debug, Clone, PartialEq)]
pub struct Arrangement {
    pub window: Area,
    pub columns: Vec<PlacedColumn>,
}

#[derive(Debug, Clone, Copy)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl Rect {
    fn right(self) -> f64 {
        self.x + self.width
    }

    fn bottom(self) -> f64 {
        self.y + self.height
    }

    fn physical(area: Area, scale: f64) -> Self {
        Self {
            x: f64::from(area.x) / scale,
            y: f64::from(area.y) / scale,
            width: f64::from(area.width) / scale,
            height: f64::from(area.height) / scale,
        }
    }

    fn overlaps(self, other: Self) -> bool {
        self.x < other.right()
            && self.right() > other.x
            && self.y < other.bottom()
            && self.bottom() > other.y
    }
}

struct Column {
    rect: Rect,
    hidden: bool,
}

/// Posiciona as subcolunas à volta da coluna principal.
///
/// `main` e `work_area` estão em pixels físicos, `scale` é a escala do monitor e `subs` as
/// subcolunas abertas, em ordem: a de índice `i` foi aberta por uma pasta da coluna `i`
/// (a principal tem o índice 0). Cada subcoluna abre:
/// - com o topo na pasta (menos `LIST_INSET`) e altura pelo conteúdo, subindo o necessário
///   para caber na área útil e ocupando toda a altura dela se for maior;
/// - à direita da anterior; sem espaço, à esquerda, desde que não cubra colunas abertas;
///   senão encostada na borda direita, escondendo as colunas mais antigas que cobrir.
pub fn arrange(main: Area, work_area: Area, scale: f64, subs: &[Subcolumn]) -> Arrangement {
    let area = Rect::physical(work_area, scale);
    let mut columns = vec![Column {
        rect: Rect::physical(main, scale),
        hidden: false,
    }];

    for (parent, sub) in subs.iter().enumerate() {
        let parent_rect = columns[parent].rect;
        let height = sub.content_height.min(area.height);
        let y = if height < area.height {
            (parent_rect.y + sub.anchor_y - LIST_INSET)
                .min(area.bottom() - height)
                .max(area.y)
        } else {
            area.y
        };
        let covers_open_column = |x: f64| {
            columns
                .iter()
                .any(|c| !c.hidden && x < c.rect.right() && x + SUB_WIDTH > c.rect.x)
        };

        let mut x = parent_rect.right() + GAP;
        let mut flush_right = false;
        if x + SUB_WIDTH > area.right() || covers_open_column(x) {
            x = parent_rect.x - SUB_WIDTH - GAP;
            if x < area.x || covers_open_column(x) {
                x = area.right() - SUB_WIDTH;
                flush_right = true;
            }
        }

        let rect = Rect {
            x,
            y,
            width: SUB_WIDTH,
            height,
        };
        if flush_right {
            for older in &mut columns[..parent] {
                if !older.hidden && older.rect.overlaps(rect) {
                    older.hidden = true;
                }
            }
        }
        columns.push(Column {
            rect,
            hidden: false,
        });
    }

    let visible = || columns.iter().filter(|c| !c.hidden).map(|c| c.rect);
    let left = visible().map(|r| r.x).fold(f64::INFINITY, f64::min);
    let top = visible().map(|r| r.y).fold(f64::INFINITY, f64::min);
    let right = visible().map(Rect::right).fold(f64::NEG_INFINITY, f64::max);
    let bottom = visible()
        .map(Rect::bottom)
        .fold(f64::NEG_INFINITY, f64::max);

    // A origem da janela é arredondada para pixels físicos; as colunas são medidas a partir
    // dela, para que a principal continue exatamente onde está.
    let window = Area {
        x: (left * scale).round() as i32,
        y: (top * scale).round() as i32,
        width: ((right * scale).round() as i32) - (left * scale).round() as i32,
        height: ((bottom * scale).round() as i32) - (top * scale).round() as i32,
    };
    let origin = (f64::from(window.x) / scale, f64::from(window.y) / scale);
    let columns = columns
        .iter()
        .map(|c| PlacedColumn {
            x: c.rect.x - origin.0,
            y: c.rect.y - origin.1,
            width: c.rect.width,
            height: c.rect.height,
            hidden: c.hidden,
        })
        .collect();
    Arrangement { window, columns }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Area = Area {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    };

    fn main_at(x: i32, y: i32) -> Area {
        Area {
            x,
            y,
            width: 340,
            height: 440,
        }
    }

    fn sub(content_height: f64, anchor_y: f64) -> Subcolumn {
        Subcolumn {
            content_height,
            anchor_y,
        }
    }

    fn placed(x: f64, y: f64, height: f64) -> PlacedColumn {
        PlacedColumn {
            x,
            y,
            width: SUB_WIDTH,
            height,
            hidden: false,
        }
    }

    /// Posição absoluta (lógica) de uma coluna na tela.
    fn on_screen(result: &Arrangement, index: usize, scale: f64) -> (f64, f64) {
        let column = result.columns[index];
        (
            f64::from(result.window.x) / scale + column.x,
            f64::from(result.window.y) / scale + column.y,
        )
    }

    #[test]
    fn without_subcolumns_the_window_is_the_main_column() {
        let result = arrange(main_at(100, 100), AREA, 1.0, &[]);

        assert_eq!(result.window, main_at(100, 100));
        assert_eq!(result.columns.len(), 1);
        assert_eq!((result.columns[0].x, result.columns[0].y), (0.0, 0.0));
    }

    #[test]
    fn opens_to_the_right_aligned_with_the_folder() {
        let result = arrange(main_at(100, 100), AREA, 1.0, &[sub(200.0, 64.0)]);

        assert_eq!(
            result.window,
            Area {
                x: 100,
                y: 100,
                width: 642,
                height: 440
            }
        );
        // Topo da pasta (164) menos a margem da lista (5).
        assert_eq!(result.columns[1], placed(342.0, 59.0, 200.0));
        assert_eq!(on_screen(&result, 1, 1.0), (442.0, 159.0));
    }

    #[test]
    fn rises_to_fit_when_it_hits_the_bottom_edge() {
        let result = arrange(main_at(100, 500), AREA, 1.0, &[sub(300.0, 400.0)]);

        // Pediria o topo em 895; o máximo que cabe é 1040 - 300 = 740.
        assert_eq!(on_screen(&result, 1, 1.0), (442.0, 740.0));
        assert_eq!(result.window.y, 500);
        assert_eq!(result.window.height, 540);
        assert_eq!(result.columns[1].y, 240.0);
    }

    #[test]
    fn may_rise_above_the_main_column() {
        let result = arrange(main_at(100, 0), AREA, 1.0, &[sub(1000.0, 400.0)]);
        // Pediria o topo em 395, mas só cabe a partir de 40.
        assert_eq!(on_screen(&result, 1, 1.0).1, 40.0);

        let result = arrange(main_at(100, 500), AREA, 1.0, &[sub(900.0, 400.0)]);
        // Sobe para 140: acima do topo da coluna principal (500).
        assert_eq!(on_screen(&result, 1, 1.0).1, 140.0);
        assert_eq!(result.window.y, 140);
        assert_eq!(result.columns[0].y, 360.0);
    }

    #[test]
    fn takes_the_whole_work_area_height_when_taller() {
        let result = arrange(main_at(100, 300), AREA, 1.0, &[sub(5000.0, 40.0)]);

        assert_eq!(result.columns[1].height, 1040.0);
        assert_eq!(on_screen(&result, 1, 1.0), (442.0, 0.0));
        assert_eq!(result.window.y, 0);
        assert_eq!(result.window.height, 1040);
        assert_eq!(result.columns[0].y, 300.0);
    }

    #[test]
    fn opens_to_the_left_without_room_on_the_right() {
        let result = arrange(main_at(1560, 100), AREA, 1.0, &[sub(200.0, 64.0)]);

        assert_eq!(on_screen(&result, 1, 1.0), (1258.0, 159.0));
        assert_eq!(result.window.x, 1258);
        assert_eq!(result.window.width, 642);
        // A principal não se mexe na tela.
        assert_eq!(on_screen(&result, 0, 1.0), (1560.0, 100.0));
        assert_eq!(result.columns[0].x, 302.0);
    }

    #[test]
    fn goes_flush_right_and_hides_older_columns_when_neither_side_fits() {
        let narrow = Area {
            x: 0,
            y: 0,
            width: 700,
            height: 1040,
        };
        let result = arrange(main_at(200, 0), narrow, 1.0, &[sub(200.0, 64.0)]);
        // Sem espaço à direita (542 + 300 > 700) nem à esquerda (200 - 302 < 0).
        assert_eq!(on_screen(&result, 1, 1.0).0, 400.0);
        // A coluna anterior da nova é a principal, que não sai de vista.
        assert!(!result.columns[0].hidden);

        let result = arrange(
            main_at(200, 0),
            narrow,
            1.0,
            &[sub(200.0, 64.0), sub(200.0, 40.0)],
        );
        assert_eq!(on_screen(&result, 2, 1.0).0, 400.0);
        // A segunda subcoluna cobre a principal, que sai de vista e deixa a janela.
        assert!(result.columns[0].hidden);
        assert!(!result.columns[1].hidden);
        assert!(!result.columns[2].hidden);
        assert_eq!(result.window.x, 400);
        assert_eq!(result.window.width, 300);
    }

    #[test]
    fn the_left_side_is_refused_when_it_would_cover_open_columns() {
        let result = arrange(
            main_at(1500, 0),
            AREA,
            1.0,
            &[sub(200.0, 40.0), sub(200.0, 40.0)],
        );

        // A primeira vai à esquerda (1198). A segunda caberia à direita (1500), mas cobriria
        // a principal; à esquerda (896) não cobre ninguém.
        assert_eq!(on_screen(&result, 1, 1.0).0, 1198.0);
        assert_eq!(on_screen(&result, 2, 1.0).0, 896.0);

        let narrow = Area {
            x: 0,
            y: 0,
            width: 1000,
            height: 1040,
        };
        let result = arrange(
            main_at(640, 0),
            narrow,
            1.0,
            &[sub(200.0, 40.0), sub(200.0, 40.0)],
        );
        // Primeira à esquerda (338). A segunda caberia à direita (640), mas cobriria a
        // principal; à esquerda (36) não cobre ninguém.
        assert_eq!(on_screen(&result, 1, 1.0).0, 338.0);
        assert_eq!(on_screen(&result, 2, 1.0).0, 36.0);
        assert!(result.columns.iter().all(|c| !c.hidden));
    }

    #[test]
    fn right_and_bottom_edges_together() {
        let result = arrange(main_at(1560, 600), AREA, 1.0, &[sub(500.0, 100.0)]);

        // À esquerda da principal e subindo até caber (1040 - 500).
        assert_eq!(on_screen(&result, 1, 1.0), (1258.0, 540.0));
        assert_eq!(result.window.x, 1258);
        assert_eq!(result.window.y, 540);
        assert_eq!(result.window.y + result.window.height, 1040);
        assert_eq!(on_screen(&result, 0, 1.0), (1560.0, 600.0));
    }

    #[test]
    fn works_in_physical_pixels_on_a_scaled_monitor() {
        let area = Area {
            x: 0,
            y: 0,
            width: 3840,
            height: 2080,
        };
        // Escala 2: a principal de 340 x 440 lógicos ocupa 680 x 880 físicos.
        let main = Area {
            x: 200,
            y: 200,
            width: 680,
            height: 880,
        };
        let result = arrange(main, area, 2.0, &[sub(200.0, 64.0)]);

        assert_eq!(
            result.window,
            Area {
                x: 200,
                y: 200,
                width: 1284,
                height: 880
            }
        );
        assert_eq!(result.columns[1], placed(342.0, 59.0, 200.0));

        // Perto da borda direita: abre à esquerda, e a principal continua no mesmo pixel.
        let main = Area {
            x: 3120,
            y: 200,
            width: 680,
            height: 880,
        };
        let result = arrange(main, area, 2.0, &[sub(200.0, 64.0)]);
        assert_eq!(result.window.x, 2516);
        assert_eq!(
            f64::from(result.window.x) + result.columns[0].x * 2.0,
            3120.0
        );
    }

    #[test]
    fn respects_a_work_area_that_does_not_start_at_the_origin() {
        let area = Area {
            x: -1280,
            y: 40,
            width: 1280,
            height: 944,
        };
        let main = Area {
            x: -1280,
            y: 500,
            width: 340,
            height: 440,
        };
        let result = arrange(main, area, 1.0, &[sub(900.0, 100.0)]);

        // Cabe à direita; sobe até o limite de baixo da área útil (984 - 900 = 84).
        assert_eq!(on_screen(&result, 1, 1.0), (-938.0, 84.0));
    }
}
