package com.company;

public class numberchild
{
    void lala()
    {
        System.out.println("this is the 1st child");
    }

}
class one extends numberchild
{
    void lolo()
    {
        System.out.println("this is the 2nd child");
    }

}
class two extends one
{
    void gadgets() {
        System.out.println("this is the 3rd child");
    }

}
class family
{
    public static void main(String[] args)
    {
        two yehey = new two();
        yehey.lala();
        yehey.lolo();
        yehey.gadgets();

    }
}
