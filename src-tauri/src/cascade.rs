//! Geometria do menu em cascata: posição de cada coluna e região visível da janela do picker.
//!
//! A janela ocupa a área útil do monitor e não se move enquanto o menu está aberto; cada
//! coluna é devolvida em coordenadas relativas a ela, e a região da janela (o que o Windows
//! desenha e onde o clique chega) cobre só as colunas visíveis. A regra de posição é a de
//! `docs/telas.md` (Tela 2, Navegação nas pastas) e a mesma do protótipo
//! `docs/prototipo/picker.html`.

use serde::{Deserialize, Serialize};

use crate::picker::Area;

/// Largura lógica das subcolunas.
pub const SUB_WIDTH: f64 = 300.0;
/// Intervalo lógico entre dois cartões.
pub const GAP: f64 = 2.0;
/// Quanto a sombra do cartão (`shadow16` do Fluent: desfoque de 16 px deslocado 8 px para
/// baixo) passa das bordas, em pixels lógicos. A região inclui essa margem para não cortá-la.
const SHADOW_SIDE: f64 = 16.0;
const SHADOW_TOP: f64 = 8.0;
const SHADOW_BOTTOM: f64 = 24.0;

/// Subcoluna aberta, em pixels lógicos. A pasta que a abriu fica na coluna anterior.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subcolumn {
    /// Altura que o conteúdo ocupa, sem rolagem.
    pub content_height: f64,
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

/// Colunas (a principal primeiro, depois as subcolunas) e região da janela: um retângulo por
/// coluna visível, com a margem da sombra, em pixels físicos relativos à janela.
#[derive(Debug, Clone, PartialEq)]
pub struct Arrangement {
    pub columns: Vec<PlacedColumn>,
    pub region: Vec<Area>,
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
/// - com o topo no da coluna principal (mesmo escondida) e altura pelo conteúdo, limitada
///   pela borda inferior da área útil (a rolagem cobre o que passar);
/// - à direita da anterior; sem espaço, à esquerda, desde que não cubra colunas abertas;
///   senão encostada na borda direita, escondendo as colunas mais antigas que cobrir.
pub fn arrange(main: Area, work_area: Area, scale: f64, subs: &[Subcolumn]) -> Arrangement {
    let area = Rect::physical(work_area, scale);
    let mut columns = vec![Column {
        rect: Rect::physical(main, scale),
        hidden: false,
    }];
    // Todas as subcolunas nascem no topo da principal, qualquer que seja o nível.
    let top = columns[0].rect.y;

    for (parent, sub) in subs.iter().enumerate() {
        let parent_rect = columns[parent].rect;
        let height = sub.content_height.min(area.bottom() - top);
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
            y: top,
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

    let placed = columns
        .iter()
        .map(|c| PlacedColumn {
            x: c.rect.x - area.x,
            y: c.rect.y - area.y,
            width: c.rect.width,
            height: c.rect.height,
            hidden: c.hidden,
        })
        .collect();
    let region = columns
        .iter()
        .filter(|c| !c.hidden)
        .map(|c| shadow_box(c.rect, work_area, scale))
        .collect();
    Arrangement {
        columns: placed,
        region,
    }
}

/// Cartão com a margem da sombra, em pixels físicos relativos à janela (a área útil) e
/// limitado a ela; arredondado para fora, para não cortar a borda do cartão.
fn shadow_box(rect: Rect, work_area: Area, scale: f64) -> Area {
    let physical = |logical: f64, origin: i32| logical * scale - f64::from(origin);
    let left = physical(rect.x - SHADOW_SIDE, work_area.x).floor().max(0.0) as i32;
    let top = physical(rect.y - SHADOW_TOP, work_area.y).floor().max(0.0) as i32;
    let right =
        (physical(rect.right() + SHADOW_SIDE, work_area.x).ceil() as i32).min(work_area.width);
    let bottom =
        (physical(rect.bottom() + SHADOW_BOTTOM, work_area.y).ceil() as i32).min(work_area.height);
    Area {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    }
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

    fn sub(content_height: f64) -> Subcolumn {
        Subcolumn { content_height }
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

    fn area(x: i32, y: i32, width: i32, height: i32) -> Area {
        Area {
            x,
            y,
            width,
            height,
        }
    }

    /// Posição absoluta (lógica) de uma coluna na tela: a janela começa na área útil.
    fn on_screen(result: &Arrangement, work_area: Area, index: usize, scale: f64) -> (f64, f64) {
        let column = result.columns[index];
        (
            f64::from(work_area.x) / scale + column.x,
            f64::from(work_area.y) / scale + column.y,
        )
    }

    #[test]
    fn the_columns_are_relative_to_the_work_area() {
        let result = arrange(main_at(100, 100), AREA, 1.0, &[]);

        assert_eq!(result.columns.len(), 1);
        assert_eq!((result.columns[0].x, result.columns[0].y), (100.0, 100.0));
        // Região: o cartão com a margem da sombra.
        assert_eq!(result.region, vec![area(84, 92, 372, 472)]);
    }

    #[test]
    fn opens_to_the_right_with_the_top_of_the_main_column() {
        let result = arrange(main_at(100, 100), AREA, 1.0, &[sub(200.0)]);

        assert_eq!(result.columns[1], placed(442.0, 100.0, 200.0));
        assert_eq!(
            result.region,
            vec![area(84, 92, 372, 472), area(426, 92, 332, 232)]
        );
    }

    #[test]
    fn the_main_column_stays_in_place() {
        let alone = arrange(main_at(1560, 600), AREA, 1.0, &[]);
        let with_subs = arrange(main_at(1560, 600), AREA, 1.0, &[sub(500.0), sub(900.0)]);

        assert_eq!(alone.columns[0], with_subs.columns[0]);
    }

    #[test]
    fn the_top_is_the_top_of_the_main_column() {
        for y in [0, 100, 500] {
            let result = arrange(main_at(100, y), AREA, 1.0, &[sub(200.0)]);

            assert_eq!(on_screen(&result, AREA, 1, 1.0), (442.0, f64::from(y)));
        }
    }

    #[test]
    fn short_content_keeps_the_content_height() {
        let result = arrange(main_at(100, 500), AREA, 1.0, &[sub(300.0)]);

        assert_eq!(result.columns[1], placed(442.0, 500.0, 300.0));
        assert_eq!(result.region[1], area(426, 492, 332, 332));
    }

    #[test]
    fn the_height_is_limited_by_the_bottom_edge() {
        let result = arrange(main_at(100, 500), AREA, 1.0, &[sub(900.0)]);

        // Do topo (500) à borda de baixo da área útil (1040).
        assert_eq!(result.columns[1], placed(442.0, 500.0, 540.0));
        // A sombra de baixo é cortada pela borda da área útil.
        assert_eq!(result.region[1], area(426, 492, 332, 548));
    }

    #[test]
    fn tall_content_never_rises_above_the_main_column() {
        let result = arrange(main_at(100, 300), AREA, 1.0, &[sub(5000.0)]);

        assert_eq!(result.columns[1], placed(442.0, 300.0, 740.0));
        assert_eq!(result.region[1], area(426, 292, 332, 748));
    }

    #[test]
    fn second_level_subcolumns_also_start_at_the_top_of_the_main_column() {
        let result = arrange(main_at(100, 200), AREA, 1.0, &[sub(300.0), sub(5000.0)]);

        assert_eq!(result.columns[1], placed(442.0, 200.0, 300.0));
        // À direita da primeira (442 + 300 + 2), no mesmo topo e limitada pela borda de baixo.
        assert_eq!(result.columns[2], placed(744.0, 200.0, 840.0));
    }

    #[test]
    fn opens_to_the_left_without_room_on_the_right() {
        let result = arrange(main_at(1560, 100), AREA, 1.0, &[sub(200.0)]);

        assert_eq!(on_screen(&result, AREA, 1, 1.0), (1258.0, 100.0));
        // A principal não se mexe na tela.
        assert_eq!(on_screen(&result, AREA, 0, 1.0), (1560.0, 100.0));
        assert_eq!(
            result.region,
            vec![area(1544, 92, 372, 472), area(1242, 92, 332, 232)]
        );
    }

    #[test]
    fn goes_flush_right_and_hides_older_columns_when_neither_side_fits() {
        let narrow = area(0, 0, 700, 1040);
        let result = arrange(main_at(200, 0), narrow, 1.0, &[sub(200.0)]);
        // Sem espaço à direita (542 + 300 > 700) nem à esquerda (200 - 302 < 0).
        assert_eq!(on_screen(&result, narrow, 1, 1.0).0, 400.0);
        // A coluna anterior da nova é a principal, que não sai de vista.
        assert!(!result.columns[0].hidden);
        assert_eq!(result.region.len(), 2);

        let result = arrange(main_at(200, 0), narrow, 1.0, &[sub(200.0), sub(200.0)]);
        assert_eq!(on_screen(&result, narrow, 2, 1.0).0, 400.0);
        // A segunda subcoluna cobre a principal, que sai de vista e da região.
        assert!(result.columns[0].hidden);
        assert!(!result.columns[1].hidden);
        assert!(!result.columns[2].hidden);
        assert_eq!(result.region.len(), 2);
        assert!(result.region.iter().all(|r| r.x >= 384));
    }

    #[test]
    fn the_left_side_is_refused_when_it_would_cover_open_columns() {
        let result = arrange(main_at(1500, 0), AREA, 1.0, &[sub(200.0), sub(200.0)]);

        // A primeira vai à esquerda (1198). A segunda caberia à direita (1500), mas cobriria
        // a principal; à esquerda (896) não cobre ninguém.
        assert_eq!(on_screen(&result, AREA, 1, 1.0).0, 1198.0);
        assert_eq!(on_screen(&result, AREA, 2, 1.0).0, 896.0);

        let narrow = area(0, 0, 1000, 1040);
        let result = arrange(main_at(640, 0), narrow, 1.0, &[sub(200.0), sub(200.0)]);
        // Primeira à esquerda (338). A segunda caberia à direita (640), mas cobriria a
        // principal; à esquerda (36) não cobre ninguém.
        assert_eq!(on_screen(&result, narrow, 1, 1.0).0, 338.0);
        assert_eq!(on_screen(&result, narrow, 2, 1.0).0, 36.0);
        assert!(result.columns.iter().all(|c| !c.hidden));
    }

    #[test]
    fn right_and_bottom_edges_together() {
        let result = arrange(main_at(1560, 600), AREA, 1.0, &[sub(500.0)]);

        // À esquerda da principal, no topo dela e até a borda de baixo (1040 - 600).
        assert_eq!(on_screen(&result, AREA, 1, 1.0), (1258.0, 600.0));
        assert_eq!(result.columns[1].height, 440.0);
        assert_eq!(on_screen(&result, AREA, 0, 1.0), (1560.0, 600.0));
    }

    #[test]
    fn works_in_physical_pixels_on_a_scaled_monitor() {
        let work_area = area(0, 0, 3840, 2080);
        // Escala 2: a principal de 340 x 440 lógicos ocupa 680 x 880 físicos.
        let result = arrange(area(200, 200, 680, 880), work_area, 2.0, &[sub(200.0)]);

        // A principal está em y = 100 lógico.
        assert_eq!(result.columns[1], placed(442.0, 100.0, 200.0));
        // Região em pixels físicos: (442 - 16) * 2 = 852 e (100 - 8) * 2 = 184.
        assert_eq!(result.region[1], area(852, 184, 664, 464));

        // A altura também é limitada pela borda de baixo, em lógicos (1040 - 100).
        let tall = arrange(area(200, 200, 680, 880), work_area, 2.0, &[sub(5000.0)]);
        assert_eq!(tall.columns[1].height, 940.0);

        // Perto da borda direita: abre à esquerda, e a principal continua no mesmo pixel.
        let result = arrange(area(3120, 200, 680, 880), work_area, 2.0, &[sub(200.0)]);
        assert_eq!(result.columns[0].x * 2.0, 3120.0);
        assert_eq!(on_screen(&result, work_area, 1, 2.0).0, 1258.0);
    }

    #[test]
    fn rounds_the_region_outward_at_fractional_scales() {
        let work_area = area(0, 0, 2880, 1560);
        // Escala 1,5: a principal de 340 x 440 lógicos em (200, 200).
        let result = arrange(area(300, 300, 510, 660), work_area, 1.5, &[sub(201.0)]);

        // Subcoluna de 542 a 842 e de 200 a 401 lógicos; com a sombra, de 789 a 1287 e
        // de 288 a 637,5 físicos, arredondados para fora.
        assert_eq!(result.region[1], area(789, 288, 498, 350));
    }

    #[test]
    fn respects_a_work_area_that_does_not_start_at_the_origin() {
        let work_area = area(-1280, 40, 1280, 944);
        let result = arrange(area(-1280, 500, 340, 440), work_area, 1.0, &[sub(900.0)]);

        // Cabe à direita, no topo da principal e até o limite de baixo da área útil (984 - 500).
        assert_eq!(on_screen(&result, work_area, 1, 1.0), (-938.0, 500.0));
        assert_eq!(result.columns[1].height, 484.0);
        // Relativas à janela, que começa em (-1280, 40).
        assert_eq!((result.columns[0].x, result.columns[0].y), (0.0, 460.0));
        assert_eq!(result.region[0], area(0, 452, 356, 472));
        assert_eq!(result.region[1], area(326, 452, 332, 492));
    }

    #[test]
    fn a_hidden_main_column_still_sets_the_top() {
        let narrow = area(0, 0, 700, 1040);
        let result = arrange(main_at(200, 50), narrow, 1.0, &[sub(200.0), sub(200.0)]);

        // A segunda subcoluna encosta à direita e cobre a principal, que sai de vista.
        assert!(result.columns[0].hidden);
        assert_eq!(on_screen(&result, narrow, 0, 1.0).1, 50.0);
        assert_eq!(on_screen(&result, narrow, 1, 1.0).1, 50.0);
        assert_eq!(on_screen(&result, narrow, 2, 1.0).1, 50.0);
    }
}
