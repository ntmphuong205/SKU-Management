import pandas as pd

# Chấp nhận nhiều tên cột khác nhau
ITEM_CODE_ALIASES = ['ItemCode', 'item_code', 'SKU', 'sku', 'MaSKU', 'ma_sku', 'Item']
DATE_ALIASES      = ['Date', 'SaleDate', 'sale_date', 'TransactionDate', 'NgayBan', 'Ngay']
QTY_ALIASES       = ['Quantity', 'quantity', 'Qty', 'qty', 'SoLuong', 'so_luong']
REVENUE_ALIASES   = ['Revenue', 'revenue', 'DoanhThu', 'doanh_thu', 'Amount', 'Total']


def _find(df: pd.DataFrame, aliases: list[str]) -> str | None:
    return next((c for c in aliases if c in df.columns), None)


def validate(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Trả về (df_cleaned, report).
    report = {valid: bool, errors: list, warnings: list, stats: dict}
    """
    errors: list[str] = []
    warnings: list[str] = []

    if len(df) == 0:
        return df, {'valid': False, 'errors': ['File không có dữ liệu'], 'warnings': [], 'stats': {}}

    # Tìm và đổi tên cột về chuẩn
    item_col = _find(df, ITEM_CODE_ALIASES)
    date_col = _find(df, DATE_ALIASES)
    qty_col  = _find(df, QTY_ALIASES)
    rev_col  = _find(df, REVENUE_ALIASES)

    if not item_col: errors.append(f"Thiếu cột mã SKU — chấp nhận: {ITEM_CODE_ALIASES[:4]}")
    if not date_col: errors.append(f"Thiếu cột ngày — chấp nhận: {DATE_ALIASES[:4]}")
    if not qty_col:  errors.append(f"Thiếu cột số lượng — chấp nhận: {QTY_ALIASES[:4]}")

    if errors:
        return df, {'valid': False, 'errors': errors, 'warnings': warnings, 'stats': {}}

    rename = {item_col: 'item_code', date_col: 'sale_date', qty_col: 'quantity'}
    if rev_col:
        rename[rev_col] = 'revenue'
    df = df.rename(columns=rename)

    # Parse ngày
    try:
        df['sale_date'] = pd.to_datetime(df['sale_date'], dayfirst=True).dt.strftime('%Y-%m-%d')
    except Exception:
        errors.append("Không parse được cột ngày — hỗ trợ: YYYY-MM-DD, DD/MM/YYYY")
        return df, {'valid': False, 'errors': errors, 'warnings': warnings, 'stats': {}}

    # Parse số
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
    df['revenue']  = pd.to_numeric(df.get('revenue', 0), errors='coerce').fillna(0)

    # Xóa dòng thiếu dữ liệu bắt buộc
    before = len(df)
    df = df.dropna(subset=['item_code', 'sale_date', 'quantity'])
    dropped_null = before - len(df)
    if dropped_null:
        warnings.append(f"Bỏ {dropped_null} dòng thiếu giá trị bắt buộc")

    # Xóa số lượng âm (returns)
    neg_mask = df['quantity'] < 0
    if neg_mask.sum():
        warnings.append(f"Bỏ {neg_mask.sum()} dòng số lượng âm (hoàn hàng)")
        df = df[~neg_mask]

    if len(df) == 0:
        errors.append("Không còn dữ liệu hợp lệ sau khi làm sạch")
        return df, {'valid': False, 'errors': errors, 'warnings': warnings, 'stats': {}}

    stats = {
        'total_rows':   before,
        'valid_rows':   len(df),
        'dropped_rows': before - len(df),
        'unique_skus':  int(df['item_code'].nunique()),
        'date_range':   f"{df['sale_date'].min()} → {df['sale_date'].max()}",
    }

    return df[['item_code', 'sale_date', 'quantity', 'revenue']], {
        'valid': True, 'errors': errors, 'warnings': warnings, 'stats': stats,
    }
