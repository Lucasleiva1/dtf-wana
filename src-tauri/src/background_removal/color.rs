#[derive(Debug, Clone, Copy, Default)]
pub struct Lab {
    pub l: f32,
    pub a: f32,
    pub b: f32,
}

pub fn rgb_to_lab(red: u16, green: u16, blue: u16, max: u16) -> Lab {
    let convert = |value: u16| {
        let normalized = value as f32 / max.max(1) as f32;
        if normalized <= 0.04045 {
            normalized / 12.92
        } else {
            ((normalized + 0.055) / 1.055).powf(2.4)
        }
    };
    let r = convert(red);
    let g = convert(green);
    let b = convert(blue);
    let x = (r * 0.412_456_4 + g * 0.357_576_1 + b * 0.180_437_5) / 0.95047;
    let y = (r * 0.212_672_9 + g * 0.715_152_2 + b * 0.072_175) / 1.0;
    let z = (r * 0.019_333_9 + g * 0.119_192 + b * 0.950_304_1) / 1.08883;
    let transform = |value: f32| {
        if value > 0.008_856 {
            value.cbrt()
        } else {
            7.787 * value + 16.0 / 116.0
        }
    };
    let fx = transform(x);
    let fy = transform(y);
    let fz = transform(z);
    Lab {
        l: 116.0 * fy - 16.0,
        a: 500.0 * (fx - fy),
        b: 200.0 * (fy - fz),
    }
}

pub fn delta_e_76(left: Lab, right: Lab) -> f32 {
    ((left.l - right.l).powi(2) + (left.a - right.a).powi(2) + (left.b - right.b).powi(2)).sqrt()
}

pub fn delta_e_2000(left: Lab, right: Lab) -> f32 {
    let c1 = (left.a * left.a + left.b * left.b).sqrt();
    let c2 = (right.a * right.a + right.b * right.b).sqrt();
    let c_bar = (c1 + c2) * 0.5;
    let g = 0.5 * (1.0 - (c_bar.powi(7) / (c_bar.powi(7) + 25_f32.powi(7))).sqrt());
    let a1p = (1.0 + g) * left.a;
    let a2p = (1.0 + g) * right.a;
    let c1p = (a1p * a1p + left.b * left.b).sqrt();
    let c2p = (a2p * a2p + right.b * right.b).sqrt();
    let hue = |a: f32, b: f32| {
        let degrees = b.atan2(a).to_degrees();
        if degrees < 0.0 { degrees + 360.0 } else { degrees }
    };
    let h1p = if c1p == 0.0 { 0.0 } else { hue(a1p, left.b) };
    let h2p = if c2p == 0.0 { 0.0 } else { hue(a2p, right.b) };
    let delta_l = right.l - left.l;
    let delta_c = c2p - c1p;
    let delta_h_angle = if c1p * c2p == 0.0 {
        0.0
    } else if (h2p - h1p).abs() <= 180.0 {
        h2p - h1p
    } else if h2p <= h1p {
        h2p - h1p + 360.0
    } else {
        h2p - h1p - 360.0
    };
    let delta_h = 2.0 * (c1p * c2p).sqrt() * (delta_h_angle.to_radians() * 0.5).sin();
    let l_bar = (left.l + right.l) * 0.5;
    let c_bar_p = (c1p + c2p) * 0.5;
    let h_bar = if c1p * c2p == 0.0 {
        h1p + h2p
    } else if (h1p - h2p).abs() <= 180.0 {
        (h1p + h2p) * 0.5
    } else if h1p + h2p < 360.0 {
        (h1p + h2p + 360.0) * 0.5
    } else {
        (h1p + h2p - 360.0) * 0.5
    };
    let t = 1.0
        - 0.17 * (h_bar - 30.0).to_radians().cos()
        + 0.24 * (2.0 * h_bar).to_radians().cos()
        + 0.32 * (3.0 * h_bar + 6.0).to_radians().cos()
        - 0.20 * (4.0 * h_bar - 63.0).to_radians().cos();
    let sl = 1.0 + 0.015 * (l_bar - 50.0).powi(2) / (20.0 + (l_bar - 50.0).powi(2)).sqrt();
    let sc = 1.0 + 0.045 * c_bar_p;
    let sh = 1.0 + 0.015 * c_bar_p * t;
    let rotation = 30.0 * (-((h_bar - 275.0) / 25.0).powi(2)).exp();
    let rc = 2.0 * (c_bar_p.powi(7) / (c_bar_p.powi(7) + 25_f32.powi(7))).sqrt();
    let rt = -rc * (2.0 * rotation).to_radians().sin();
    let l = delta_l / sl;
    let c = delta_c / sc;
    let h = delta_h / sh;
    (l * l + c * c + h * h + rt * c * h).max(0.0).sqrt()
}

pub fn chroma(lab: Lab) -> f32 {
    (lab.a * lab.a + lab.b * lab.b).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_srgb_reference_white_to_lab_white() {
        let white = rgb_to_lab(255, 255, 255, 255);
        assert!((white.l - 100.0).abs() < 0.02);
        assert!(white.a.abs() < 0.02);
        assert!(white.b.abs() < 0.02);
    }

    #[test]
    fn delta_e_2000_matches_published_reference_pair() {
        let left = Lab { l: 50.0, a: 2.6772, b: -79.7751 };
        let right = Lab { l: 50.0, a: 0.0, b: -82.7485 };
        assert!((delta_e_2000(left, right) - 2.0425).abs() < 0.0006);
    }
}
