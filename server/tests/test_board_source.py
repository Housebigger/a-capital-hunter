from server.capital_flow.board_source import (
    BoardInfo,
    BoardMembershipSource,
    FakeBoardSource,
)
from server.capital_flow.registry_builder import MemberBasic


def test_fake_board_source_satisfies_protocol_and_returns_data():
    src: BoardMembershipSource = FakeBoardSource(
        latest="20260617",
        boards=[BoardInfo(ts_code="885001.TI", name="CPO", member_count=2)],
        members={"885001.TI": ["300308.SZ", "300502.SZ"]},
        basics={
            "300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
            "300502.SZ": MemberBasic("300502.SZ", "新易盛", 5e6, 8e5, "20160101"),
        },
    )
    assert src.latest_trade_date() == "20260617"
    assert src.list_boards()[0].name == "CPO"
    assert src.board_members("885001.TI") == ["300308.SZ", "300502.SZ"]
    assert src.basics("20260617")["300308.SZ"].name == "中际旭创"
